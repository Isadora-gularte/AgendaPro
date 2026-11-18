import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardTypeOptions,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Session, User } from '@supabase/supabase-js';
import { CalendarDays, Building2, UserRound, ArrowLeft, LogOut, RefreshCw, Eye, EyeOff, Search, Clock3, Sparkles, CheckCircle2, MapPin, Camera, UserCircle2, ExternalLink } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

type AccountType = 'cliente' | 'empresa';
type Page = 'inicio' | 'login' | 'cadastro' | 'aguardando';
type Tab = 'servicos' | 'agenda' | 'perfil';
type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  account_type: AccountType;
  avatar_path: string | null;
};
type Company = { id: string; display_name: string; category: string;
  street: string | null; street_number: string | null;
  neighborhood: string | null; city: string | null;
  state: string | null; postal_code: string | null; address_extra: string | null;
};
type CompanyLocation = Pick<Company, 'street' | 'street_number' | 'neighborhood' | 'city' | 'state' | 'postal_code' | 'address_extra'>;
function companyAddress(company: CompanyLocation | null | undefined): string {
  if (!company) return '';
  return [
    [company.street, company.street_number].filter(Boolean).join(', '),
    company.address_extra,
    company.neighborhood,
    [company.city, company.state].filter(Boolean).join(' - '),
    company.postal_code ? `CEP ${company.postal_code}` : '',
  ].filter(Boolean).join(' · ');
}
async function openCompanyMap(company: CompanyLocation | null | undefined) {
  const location = companyAddress(company);
  if (!location) return Alert.alert('Endereço não informado', 'Esta empresa ainda não cadastrou o endereço.');
  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [
        [company?.street, company?.street_number].filter(Boolean).join(', '),
        company?.neighborhood, company?.city, company?.state, company?.postal_code,
      ].filter(Boolean).join(', ')
    )}`);
  } catch { Alert.alert('Não foi possível abrir o mapa', 'Confira se há um navegador instalado no celular.'); }
}
type Service = {
  id: string;
  company_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  companies?: (CompanyLocation & { display_name: string }) | null;
};
type Booking = {
  id: string;
  service_id: string;
  client_id: string;
  client_name: string | null;
  starts_at: string;
  ends_at: string;
  status: Status;
  services?: { name: string } | null;
  companies?: { display_name: string } | null;
};

const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const time = (value: string) => new Date(value).toLocaleString('pt-BR');
const AUTH_REDIRECT_URL = 'agendaplus://confirmacao';

function getLinkParameter(url: string, key: string): string | undefined {
  for (const fragment of url.split(/[?#]/).slice(1)) {
    for (const entry of fragment.split('&')) {
      const equals = entry.indexOf('=');
      if (equals >= 0 && entry.slice(0, equals) === key) {
        try { return decodeURIComponent(entry.slice(equals + 1).replace(/\+/g, ' ')); }
        catch { return undefined; }
      }
    }
  }
  return undefined;
}

const statusLabel: Record<Status, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

function Button({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      style={[styles.button, secondary && styles.buttonOutline, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonOutlineText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = 'default' }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, secureTextEntry && styles.passwordInput]}
          placeholder={placeholder}
          placeholderTextColor="#95806b"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !passwordVisible}
          keyboardType={keyboardType}
          autoCapitalize={secureTextEntry || keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={!secureTextEntry}
        />
        {secureTextEntry && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            accessibilityHint="Alterna a visualização dos caracteres digitados"
            style={styles.passwordToggle}
            onPress={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible
              ? <EyeOff color="#e4b77c" size={22} />
              : <Eye color="#e4b77c" size={22} />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function formatDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

const appointmentHours = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];

function upcomingDates(): { key: string; label: string }[] {
  return Array.from({ length: 14 }, (_, index) => {
    const current = new Date();
    current.setHours(12, 0, 0, 0);
    current.setDate(current.getDate() + index);
    return { key: formatDateKey(current),
      label: current.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) };
  });
}

function parseLocalDate(date: string, hour: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(hour)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hour.split(':').map(Number);
  const result = new Date(y, m - 1, d, hh, mm);
  if (result.getFullYear() !== y || result.getMonth() !== m - 1 ||
      result.getDate() !== d || result.getHours() !== hh || result.getMinutes() !== mm) return null;
  return result;
}

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>('inicio');
  const [tab, setTab] = useState<Tab>('servicos');
  const [registerType, setRegisterType] = useState<AccountType>('cliente');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressExtra, setAddressExtra] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [availableDates] = useState(upcomingDates);
  const visibleServices = services;
  const pendingCount = useMemo(() => bookings.filter((booking) => booking.status === 'pending').length, [bookings]);

  useEffect(() => {
    let alive = true;
    let lastProcessedUrl: string | null = null;
    async function handleAuthUrl(url: string | null) {
      if (!alive || !url || !url.startsWith('agendaplus:') || url.includes('://confirmacao') || url === lastProcessedUrl) return;
      lastProcessedUrl = url;
      const error = getLinkParameter(url, 'error_description');
      if (error) {
        Alert.alert('Não foi possível confirmar', error.replace(/\+/g, ' '));
        return;
      }
      const accessToken = getLinkParameter(url, 'access_token');
      const refreshToken = getLinkParameter(url, 'refresh_token');
      const code = getLinkParameter(url, 'code');
      try {
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken, refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          setAwaitingConfirmation(false);
          Alert.alert('E-mail confirmado!', 'Sua conta está pronta para uso no Agenda+.');
        } else if (code) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          setAwaitingConfirmation(false);
          Alert.alert('E-mail confirmado!', 'Sua conta está pronta para uso no Agenda+.');
        }
      } catch (err) {
        Alert.alert('Erro na confirmação', String((err as Error).message));
      }
    }
    Linking.getInitialURL().then(handleAuthUrl).catch(() => {});
    const linkingListener = Linking.addEventListener('url', ({ url }) => { void handleAuthUrl(url); });
    return () => { alive = false; linkingListener.remove(); };
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) Alert.alert('Sessão', error.message);
      setSession(data.session);
      setBooting(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const loadData = useCallback(async (user: User) => {
    const { data: existing, error: profileError } = await supabase
      .from('profiles').select('id,full_name,phone,account_type,avatar_path')
      .eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;

    let nextProfile = existing as Profile | null;
    if (!nextProfile) {
      const metadata = user.user_metadata || {};
      const accountType: AccountType = metadata.account_type === 'empresa' ? 'empresa' : 'cliente';
      const fullName = String(metadata.full_name || user.email?.split('@')[0] || 'Usuário');
      const { data: created, error: createdError } = await supabase.from('profiles')
        .insert({
          id: user.id,
          full_name: fullName.length >= 2 ? fullName.slice(0, 120) : 'Usuário',
          phone: metadata.phone || null,
          account_type: accountType,
        })
        .select('id,full_name,phone,account_type,avatar_path').single();
      if (createdError) throw createdError;
      nextProfile = created as Profile;
    }
    setProfile(nextProfile);
    setProfileName(nextProfile.full_name);
    setProfilePhone(nextProfile.phone || '');

    if (nextProfile.account_type === 'empresa') {
      const { data: owned, error: companyError } = await supabase
        .from('companies').select('id,display_name,category,street,street_number,neighborhood,city,state,postal_code,address_extra')
        .eq('owner_id', user.id).maybeSingle();
      if (companyError) throw companyError;
      const nextCompany = (owned as Company | null) ?? null;
      setCompany(nextCompany);
      if (nextCompany) {
        setStreet(nextCompany.street || ''); setStreetNumber(nextCompany.street_number || '');
        setNeighborhood(nextCompany.neighborhood || ''); setCity(nextCompany.city || '');
        setState(nextCompany.state || ''); setPostalCode(nextCompany.postal_code || '');
        setAddressExtra(nextCompany.address_extra || '');
        const [serviceResult, bookingResult] = await Promise.all([
          supabase.from('services').select('id,company_id,name,duration_minutes,price_cents,is_active')
            .eq('company_id', nextCompany.id).order('created_at', { ascending: false }).limit(80),
          supabase.from('bookings')
            .select('id,service_id,client_id,client_name,starts_at,ends_at,status,services(name)')
            .eq('company_id', nextCompany.id).order('starts_at', { ascending: false }).limit(100),
        ]);
        if (serviceResult.error) throw serviceResult.error;
        if (bookingResult.error) throw bookingResult.error;
        setServices((serviceResult.data ?? []) as unknown as Service[]);
        setBookings((bookingResult.data ?? []) as unknown as Booking[]);
      } else {
        setServices([]); setBookings([]);
      }
    } else {
      setCompany(null);
      const { data: bookingData, error: bookingError } = await supabase.from('bookings')
        .select('id,service_id,client_id,client_name,starts_at,ends_at,status,services(name),companies(display_name)')
        .eq('client_id', user.id).order('starts_at', { ascending: false }).limit(200);
      if (bookingError) throw bookingError;
      setBookings((bookingData ?? []) as unknown as Booking[]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const path = profile?.avatar_path;
    if (!path) { setAvatarUrl(null); return; }
    supabase.storage.from('profile-photos').createSignedUrl(path, 60 * 60)
      .then(({ data, error }) => {
        if (!cancelled) setAvatarUrl(error ? null : (data?.signedUrl || null));
      })
      .catch(() => { if (!cancelled) setAvatarUrl(null); });
    return () => { cancelled = true; };
  }, [profile?.avatar_path]);

  useEffect(() => {
    if (!session?.user || profile?.account_type !== 'cliente') return;
    const query = searchTerm.trim();
    if (query.length < 2) {
      setServices([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true); setSearchError('');
      try {
        const commonSelect = 'id,company_id,name,duration_minutes,price_cents,is_active,companies(display_name,street,street_number,neighborhood,city,state,postal_code,address_extra)';
        const [namedCompanies, namedServices] = await Promise.all([
          supabase.from('companies').select('id').eq('is_active', true)
            .ilike('display_name', `%${query}%`).limit(30),
          supabase.from('services').select(commonSelect)
            .eq('is_active', true).ilike('name', `%${query}%`).limit(40),
        ]);
        if (namedCompanies.error) throw namedCompanies.error;
        if (namedServices.error) throw namedServices.error;
        const ids = (namedCompanies.data || []).map((item) => item.id);
        let matched = (namedServices.data || []) as unknown as Service[];
        if (ids.length) {
          const byCompany = await supabase.from('services').select(commonSelect)
            .eq('is_active', true).in('company_id', ids).limit(70);
          if (byCompany.error) throw byCompany.error;
          matched = [...matched, ...((byCompany.data || []) as unknown as Service[])];
        }
        if (!cancelled) {
          setServices(Array.from(new Map(matched.map((item) => [item.id, item])).values()));
        }
      } catch {
        if (!cancelled) { setServices([]); setSearchError('Não foi possível pesquisar agora. Tente novamente.'); }
      } finally { if (!cancelled) setSearching(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm, profile?.account_type, session?.user.id]);

  useEffect(() => {
    let active = true;
    const user = session?.user;
    if (!user) {
      setProfile(null); setCompany(null); setServices([]); setBookings([]);
      setBooting(false);
      return;
    }
    setBooting(true);
    loadData(user)
      .catch((error: unknown) => { if (active) Alert.alert('Erro ao carregar', String((error as Error)?.message ?? error)); })
      .finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, [session?.user.id, loadData]);

  async function refresh() {
    if (!session?.user) return;
    setBusy(true);
    try { await loadData(session.user); }
    catch (e) { Alert.alert('Falha ao atualizar', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function login() {
    if (!email.trim() || !password) return Alert.alert('Preencha o e-mail e a senha.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (error) throw error;
      setPassword('');
    } catch (e) {
      const error = e as { message?: string; code?: string };
      if (error.code === 'invalid_credentials') {
        Alert.alert('Dados de acesso inválidos', 'O e-mail ou a senha não conferem. Use a senha do cadastro, sem criar outra conta.');
      } else if (error.code === 'email_not_confirmed') {
        setAwaitingConfirmation(true);
        Alert.alert('Confirme seu e-mail', 'Confira sua caixa de entrada e spam. Você pode reenviar a confirmação nesta tela.');
      } else {
        Alert.alert('Não foi possível entrar', String(error.message ?? e));
      }
    }
    finally { setBusy(false); }
  }

  async function register() {
    if (name.trim().length < 2 || !email.includes('@') || password.length < 6) {
      return Alert.alert('Confira os dados', 'Informe nome, e-mail válido e senha de pelo menos 6 caracteres.');
    }
    if (password !== repeatPassword) return Alert.alert('As senhas precisam ser iguais.');
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL,
          data: { full_name: name.trim(), phone: phone.trim() || null, account_type: registerType },
        },
      });
      if (error) throw error;
      setPassword(''); setRepeatPassword('');
      if (!data.session) {
        setAwaitingConfirmation(true);
        setPage('aguardando');
      } else {
        setPage('inicio');
      }
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'over_email_send_rate_limit' || /email rate limit exceeded/i.test(err.message ?? '')) {
        Alert.alert('Envio de e-mails temporariamente limitado',
          'O serviço de confirmação de e-mails do Agenda+ atingiu o limite. Tente novamente mais tarde. Não é necessário mudar seu e-mail.');
      } else if (err.code === 'email_address_not_authorized') {
        Alert.alert('Envio de e-mails não configurado',
          'O Agenda+ ainda está configurando o envio de e-mails para pessoas externas ao projeto. Entre em contato com a equipe de testes.');
      } else {
        Alert.alert('Erro no cadastro', String(err.message ?? e));
      }
    }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    if (!email.trim().includes('@')) {
      Alert.alert('Informe seu e-mail', 'Digite o mesmo endereço que você usou no cadastro.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      if (error) throw error;
      Alert.alert('Solicitação enviada', 'Se a conta ainda não estiver confirmada, verifique sua caixa de entrada e Spam.');
    } catch (e) {
      const err = e as { message?: string; code?: string };
      if (err.code === 'over_email_send_rate_limit') {
        Alert.alert('Limite de envios', 'Você já pediu vários e-mails. Aguarde alguns minutos antes de tentar novamente.');
      } else {
        Alert.alert('Não foi possível reenviar', String(err.message ?? e));
      }
    } finally { setBusy(false); }
  }

  async function createCompany() {
    if (!session?.user || companyName.trim().length < 2) {
      return Alert.alert('Informe o nome da empresa.');
    }
    setBusy(true);
    try {
      if (!street.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
        return Alert.alert('Complete o endereço', 'Informe rua, bairro, cidade e estado para ajudar os clientes a encontrar a empresa.');
      }
      const { error } = await supabase.from('companies').insert({
        owner_id: session.user.id,
        display_name: companyName.trim(),
        category: category.trim() || 'Serviços',
        street: street.trim(), street_number: streetNumber.trim() || null,
        neighborhood: neighborhood.trim(), city: city.trim(),
        state: state.trim().toUpperCase(), postal_code: postalCode.trim() || null,
        address_extra: addressExtra.trim() || null,
      });
      if (error) throw error;
      setCompanyName(''); setCategory('');
      await loadData(session.user);
      Alert.alert('Empresa cadastrada', 'Agora você já pode cadastrar os seus serviços.');
    } catch (e) { Alert.alert('Erro ao salvar empresa', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function saveCompanyAddress() {
    if (!company || !session?.user) return;
    if (!street.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      return Alert.alert('Confira o endereço', 'Rua, bairro, cidade e estado são obrigatórios.');
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from('companies').update({
        street: street.trim(), street_number: streetNumber.trim() || null,
        neighborhood: neighborhood.trim(), city: city.trim(), state: state.trim().toUpperCase(),
        postal_code: postalCode.trim() || null, address_extra: addressExtra.trim() || null,
      }).eq('id', company.id).eq('owner_id', session.user.id)
        .select('id,display_name,category,street,street_number,neighborhood,city,state,postal_code,address_extra').single();
      if (error) throw error;
      setCompany(data as Company);
      Alert.alert('Endereço atualizado', 'Agora seus clientes podem encontrá-lo no mapa.');
    } catch (e) { Alert.alert('Não foi possível salvar', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function saveMyProfile() {
    if (!session?.user || profileName.trim().length < 2) {
      return Alert.alert('Informe um nome com pelo menos dois caracteres.');
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from('profiles')
        .update({ full_name: profileName.trim(), phone: profilePhone.trim() || null })
        .eq('id', session.user.id)
        .select('id,full_name,phone,account_type,avatar_path').single();
      if (error) throw error;
      setProfile(data as Profile);
      Alert.alert('Perfil atualizado!', 'Suas informações foram salvas.');
    } catch (e) { Alert.alert('Erro ao salvar perfil', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function uploadAvatar() {
    if (!session?.user || !profile) return;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true,
        aspect: [1, 1], quality: 0.7, exif: false,
      });
      if (picked.canceled || !picked.assets.length) return;
      const chosen = picked.assets[0];
      if (chosen.fileSize && chosen.fileSize > 5 * 1024 * 1024) {
        return Alert.alert('Imagem muito grande', 'Escolha uma foto de até 5 MB.');
      }
      setBusy(true);
      const contentType = chosen.mimeType === 'image/png' ? 'image/png'
        : chosen.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
      const filePath = `${session.user.id}/${Date.now()}.${ext}`;
      const response = await fetch(chosen.uri);
      if (!response.ok) throw new Error('Não foi possível ler a imagem escolhida.');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 5 * 1024 * 1024) {
        return Alert.alert('Imagem muito grande', 'Escolha uma foto de até 5 MB.');
      }
      const { error: uploadError } = await supabase.storage.from('profile-photos')
        .upload(filePath, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await supabase.from('profiles')
        .update({ avatar_path: filePath }).eq('id', session.user.id)
        .select('id,full_name,phone,account_type,avatar_path').single();
      if (error) throw error;
      setProfile(data as Profile);
      Alert.alert('Foto atualizada!', 'Sua foto foi salva no perfil.');
    } catch (e) { Alert.alert('Erro ao enviar foto', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  function renderAddressFields() {
    return (
      <>
        <Field label="Rua / Avenida" value={street} onChangeText={setStreet} placeholder="Ex.: Rua XV de Novembro" />
        <Field label="Número" value={streetNumber} onChangeText={setStreetNumber} keyboardType="number-pad" placeholder="Ex.: 123" />
        <Field label="Bairro" value={neighborhood} onChangeText={setNeighborhood} placeholder="Ex.: Centro" />
        <Field label="Cidade" value={city} onChangeText={setCity} placeholder="Ex.: Curitiba" />
        <Field label="Estado (UF)" value={state} onChangeText={setState} placeholder="Ex.: PR" />
        <Field label="CEP (opcional)" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" placeholder="Ex.: 80000-000" />
        <Field label="Complemento (opcional)" value={addressExtra} onChangeText={setAddressExtra} placeholder="Ex.: Sala 12" />
      </>
    );
  }

  async function createService() {
    if (!company || serviceName.trim().length < 2) return Alert.alert('Digite o nome do serviço.');
    const amount = Number(price.replace(',', '.'));
    const minutes = Number(duration);
    if (!Number.isFinite(amount) || amount < 0 || amount > 50000 ||
        !Number.isInteger(minutes) || minutes < 15 || minutes > 240) {
      return Alert.alert('Confira o preço e a duração (15 a 240 minutos).');
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from('services').insert({
        company_id: company.id, name: serviceName.trim(),
        price_cents: Math.round(amount * 100), duration_minutes: minutes,
      }).select('id,company_id,name,duration_minutes,price_cents,is_active').single();
      if (error) throw error;
      setServiceName(''); setPrice(''); setDuration('30');
      if (data) setServices((prev) => [data as Service, ...prev]);
      Alert.alert('Serviço cadastrado!', 'Seu novo serviço já aparece na lista.');
    } catch (e) { Alert.alert('Erro ao criar serviço', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function refreshAfterAction() {
    if (session?.user) await loadData(session.user);
  }

  async function book() {
    if (!selectedService || !session?.user) return;
    const startsAt = parseLocalDate(selectedDate, selectedHour);
    if (!startsAt) return Alert.alert('Data inválida', 'Use AAAA-MM-DD e HH:MM. Exemplo: 2026-12-10 e 14:30.');
    setBusy(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        client_id: session.user.id, service_id: selectedService.id,
        starts_at: startsAt.toISOString(),
      });
      if (error) throw error;
      setSelectedService(null); setSelectedDate(''); setSelectedHour('');
      setTab('agenda');
      await refreshAfterAction();
      Alert.alert('Agendamento solicitado!', 'A empresa poderá confirmar o horário.');
    } catch (e) {
      const message = String((e as Error).message);
      Alert.alert('Não foi possível agendar',
        message.includes('bookings_company_no_overlap') || message.includes('conflicting key value') ?
          'Este horário já está ocupado. Escolha outro horário.' : message);
    } finally { setBusy(false); }
  }

  async function toggleService(service: Service) {
    if (profile?.account_type !== 'empresa') return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('services')
        .update({ is_active: !service.is_active })
        .eq('id', service.id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Serviço não encontrado para atualização.');
      setServices((prev) => prev.map((item) => item.id === service.id
        ? { ...item, is_active: !item.is_active } : item));
    } catch (e) { Alert.alert('Não foi possível atualizar o serviço', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function changeBookingStatus(id: string, status: Status) {
    setBusy(true);
    try {
      const { data, error } = await supabase.from('bookings').update({ status })
        .eq('id', id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Agendamento não encontrado.');
      setBookings((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
    } catch (e) { Alert.alert('Não foi possível atualizar', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPage('inicio'); setTab('servicos'); setSearchTerm('');
      setSelectedService(null);
    } catch (e) { Alert.alert('Erro ao sair', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}><ActivityIndicator color="#daa867" size="large" /><Text style={styles.muted}>Carregando Agenda+...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#382317" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!session ? (
          <>
            <View style={styles.brand}>
              <View style={styles.logo}><CalendarDays color="#e4b77c" size={36} /></View>
              <Text style={styles.title}>Agenda<Text style={styles.plus}>+</Text></Text>
              <Text style={styles.subtitle}>Cuidado & Organização</Text>
              <Text style={styles.description}>Conectando pessoas, serviços e bons momentos.</Text>
              <View style={styles.heroLine}><Sparkles color="#e4b77c" size={14} /><Text style={styles.heroLineText}>Mais tempo para o que importa</Text></View>
            </View>

            {page === 'inicio' && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>COMECE POR AQUI</Text>
                <Text style={styles.cardTitle}>Bem-vindo(a) ao seu espaço!</Text>
                <Text style={styles.muted}>Uma maneira mais simples de organizar atendimentos e encontrar o horário ideal.</Text>
                <Button label="Entrar" onPress={() => setPage('login')} />
                <Button secondary label="Criar conta" onPress={() => setPage('cadastro')} />
              </View>
            )}

            {page === 'aguardando' && (
              <View style={styles.card}>
                <View style={styles.successCircle}><CheckCircle2 color="#e4b77c" size={40} /></View>
                <Text style={styles.eyebrow}>ÚLTIMA ETAPA</Text>
                <Text style={styles.cardTitle}>Confirme seu e-mail</Text>
                <Text style={styles.muted}>Sua solicitação de cadastro foi recebida. Abra a mensagem enviada para {email.trim()} e toque no link de confirmação. Quando o endereço estiver autorizado no Supabase, ele abrirá a tela de confirmação do Agenda+.</Text>
                <Text style={styles.muted}>Se o link já foi usado, tente entrar normalmente. Não crie várias contas para resolver um link expirado.</Text>
                <Button label="Já confirmei · Entrar" onPress={() => setPage('login')} />
                <Button label={busy ? 'Reenviando...' : 'Reenviar confirmação'} secondary disabled={busy} onPress={resendConfirmation} />
                <Button label="Voltar ao início" secondary onPress={() => setPage('inicio')} />
              </View>
            )}
            {page === 'login' && (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => setPage('inicio')} style={styles.back}><ArrowLeft color="#e4b77c" size={20} /><Text style={styles.link}>Voltar</Text></TouchableOpacity>
                <Text style={styles.eyebrow}>BOM TER VOCÊ DE VOLTA</Text>
                <Text style={styles.cardTitle}>Entrar na minha conta</Text>
                <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="voce@email.com" />
                <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="Sua senha" />
                <Button label={busy ? 'Entrando...' : 'Entrar'} onPress={login} disabled={busy} />
                {awaitingConfirmation && (
                  <>
                    <Text style={styles.muted}>Se você já confirmou o e-mail, pode entrar normalmente. Links de confirmação só funcionam uma vez.</Text>
                    <Button label={busy ? 'Reenviando...' : 'Reenviar confirmação'} secondary
                      onPress={resendConfirmation} disabled={busy} />
                  </>
                )}
                <Button label="Reenviar e-mail de confirmação" secondary disabled={busy} onPress={resendConfirmation} />
                <Button label="Ainda não tenho conta" secondary onPress={() => setPage('cadastro')} />
              </View>
            )}

            {page === 'cadastro' && (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => setPage('inicio')} style={styles.back}><ArrowLeft color="#e4b77c" size={20} /><Text style={styles.link}>Voltar</Text></TouchableOpacity>
                <Text style={styles.eyebrow}>SEU ESPAÇO, SEU RITMO</Text>
                <Text style={styles.cardTitle}>Criar conta</Text>
                <Text style={styles.muted}>Como você deseja usar o Agenda+?</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.choice, registerType === 'cliente' && styles.choiceActive]} onPress={() => setRegisterType('cliente')}>
                    <UserRound color="#e4b77c" size={24} /><Text style={styles.choiceText}>Sou cliente</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.choice, registerType === 'empresa' && styles.choiceActive]} onPress={() => setRegisterType('empresa')}>
                    <Building2 color="#e4b77c" size={24} /><Text style={styles.choiceText}>Sou empresa</Text>
                  </TouchableOpacity>
                </View>
                <Field label="Nome completo" value={name} onChangeText={setName} />
                <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="voce@email.com" />
                <Field label="Telefone (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <Field label="Senha (mínimo 6 caracteres)" value={password} onChangeText={setPassword} secureTextEntry />
                <Field label="Confirmar senha" value={repeatPassword} onChangeText={setRepeatPassword} secureTextEntry />
                <Button label={busy ? 'Criando conta...' : 'Cadastrar'} onPress={register} disabled={busy} />
                <Button secondary label="Já tenho uma conta" onPress={() => setPage('login')} />
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.titleSmall}>Agenda<Text style={styles.plus}>+</Text></Text>
                <Text style={styles.muted}>Olá, {profile?.full_name || 'usuário(a)'}!</Text>
                <Text style={styles.role}>{profile?.account_type === 'empresa' ? 'Painel da empresa' : 'Área do cliente'}</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity accessibilityLabel="Atualizar" onPress={refresh} disabled={busy}><RefreshCw color="#e4b77c" size={22} /></TouchableOpacity>
                <TouchableOpacity accessibilityLabel="Sair" onPress={logout} disabled={busy}><LogOut color="#e4b77c" size={22} /></TouchableOpacity>
              </View>
            </View>
            {profile && (
              <View style={styles.dashboardBanner}>
                <View style={styles.bannerIcon}>
                  {profile.account_type === 'empresa'
                    ? <Building2 color="#f6d29a" size={25} />
                    : <CalendarDays color="#f6d29a" size={25} />}
                </View>
                <View style={styles.bannerCopy}>
                  <Text style={styles.eyebrow}>{profile.account_type === 'empresa' ? 'SEU NEGÓCIO EM DIA' : 'SEUS HORÁRIOS EM DIA'}</Text>
                  <Text style={styles.bannerTitle}>{profile.account_type === 'empresa'
                    ? (company?.display_name || 'Organize seu negócio')
                    : 'Seu tempo é precioso'}</Text>
                  <Text style={styles.bannerDetail}>{pendingCount > 0
                    ? `${pendingCount} agendamento${pendingCount > 1 ? 's' : ''} aguardando confirmação`
                    : 'Tudo organizado por aqui. ✨'}</Text>
                </View>
              </View>
            )}
            {!profile ? (
              <View style={styles.card}><Text style={styles.muted}>O perfil não pôde ser carregado.</Text><Button label="Tentar novamente" onPress={refresh} /></View>
            ) : (
              <>
                {profile.account_type === 'empresa' && !company ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Cadastre sua empresa</Text>
                    <Text style={styles.muted}>Depois você poderá anunciar serviços e acompanhar a agenda.</Text>
                    <Field label="Nome da empresa" value={companyName} onChangeText={setCompanyName} placeholder="Ex.: Salão Bela Vida" />
                    <Field label="Categoria" value={category} onChangeText={setCategory} placeholder="Ex.: Beleza e estética" />
                    <Text style={styles.sectionTitle}>Onde sua empresa atende?</Text>
                    {renderAddressFields()}
                    <Button label={busy ? 'Salvando...' : 'Cadastrar empresa'} onPress={createCompany} disabled={busy} />
                  </View>
                ) : (
                  <>
                    <View style={styles.tabRow}>
                      <TouchableOpacity style={[styles.tab, tab === 'servicos' && styles.tabSelected]} onPress={() => setTab('servicos')}>
                        <Text style={styles.tabText}>{profile.account_type === 'empresa' ? 'Meus serviços' : 'Buscar serviços'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.tab, tab === 'agenda' && styles.tabSelected]} onPress={() => setTab('agenda')}>
                        <Text style={styles.tabText}>Agenda</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.tab, tab === 'perfil' && styles.tabSelected]} onPress={() => setTab('perfil')}>
                        <Text style={styles.tabText}>Meu perfil</Text>
                      </TouchableOpacity>
                    </View>

                    {tab === 'servicos' && (
                      <>
                        {profile.account_type === 'empresa' && (
                          <View style={styles.card}>
                            <Text style={styles.cardTitle}>{company?.display_name}</Text>
                            <Text style={styles.muted}>Cadastre um serviço para disponibilizá-lo aos clientes.</Text>
                            <Field label="Nome do serviço" value={serviceName} onChangeText={setServiceName} placeholder="Ex.: Corte de cabelo" />
                            <Field label="Preço (R$)" value={price} onChangeText={setPrice} placeholder="Ex.: 50,00" keyboardType="decimal-pad" />
                            <Field label="Duração (minutos)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
                            <Button label={busy ? 'Salvando...' : 'Adicionar serviço'} onPress={createService} disabled={busy} />
                          </View>
                        )}
                        <Text style={styles.sectionTitle}>{profile.account_type === 'empresa' ? 'Serviços cadastrados' : 'Encontre uma empresa'}</Text>
                        {profile.account_type === 'cliente' &&
                          <Text style={styles.muted}>Digite o nome da clínica, do estabelecimento ou do serviço. Nada será exibido antes da sua pesquisa.</Text>}
                        {profile.account_type === 'cliente' && (
                          <View style={styles.searchBar}>
                            <Search color="#cfae86" size={20} />
                            <TextInput
                              style={styles.searchInput}
                              value={searchTerm}
                              onChangeText={setSearchTerm}
                              autoCorrect={false}
                              placeholder="Ex.: Clínica Psicologia Isadora"
                              placeholderTextColor="#9e8b7a"
                              accessibilityLabel="Buscar serviços e empresas"
                            />
                          </View>
                        )}
                        {profile.account_type === 'cliente' && searchTerm.trim().length < 2 &&
                          <View style={styles.searchEmpty}><Search color="#e4b77c" size={30}/>
                            <Text style={styles.emptyTitle}>O que você procura?</Text>
                            <Text style={styles.muted}>Pesquise pelo nome da empresa ou pelo atendimento. Só mostraremos resultados correspondentes.</Text>
                          </View>}
                        {profile.account_type === 'cliente' && searching &&
                          <View style={styles.loadingInline}><ActivityIndicator color="#e4b77c"/><Text style={styles.muted}>Pesquisando...</Text></View>}
                        {!!searchError && <Text style={styles.muted}>{searchError}</Text>}
                        {profile.account_type === 'cliente' && searchTerm.trim().length >= 2 && !searching && !searchError && visibleServices.length === 0 &&
                          <Text style={styles.muted}>Nenhum resultado para essa pesquisa. Confira o nome da empresa.</Text>}
                        {profile.account_type === 'empresa' && visibleServices.length === 0 &&
                          <Text style={styles.muted}>Sua empresa ainda não possui serviços cadastrados.</Text>}
                        {visibleServices.map((service) => (
                          <View key={service.id} style={styles.card}>
                            <View style={styles.serviceHeader}>
                              <View style={styles.serviceIcon}><CalendarDays color="#e4b77c" size={23}/></View>
                              <View style={styles.serviceTitleWrap}>
                                <Text style={styles.cardTitle}>{service.name}</Text>
                                {service.companies && <Text style={styles.muted}>{service.companies.display_name}</Text>}
                              </View>
                            </View>
                            {profile.account_type === 'cliente' && service.companies &&
                              <View style={styles.addressCard}>
                                <MapPin color="#e4b77c" size={17}/>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.addressText}>{companyAddress(service.companies) || 'Endereço ainda não informado pela empresa'}</Text>
                                  {!!companyAddress(service.companies) &&
                                    <TouchableOpacity onPress={() => openCompanyMap(service.companies)}
                                      accessibilityRole="button" style={styles.mapLink}>
                                      <Text style={styles.link}>Ver localização no Google Maps</Text>
                                      <ExternalLink color="#e4b77c" size={15}/>
                                    </TouchableOpacity>}
                                </View>
                              </View>}
                            <View style={styles.serviceMeta}>
                              <View style={styles.infoPill}><Clock3 color="#e4b77c" size={15}/><Text style={styles.infoText}>{service.duration_minutes} min</Text></View>
                              <Text style={styles.price}>{money(service.price_cents)}</Text>
                            </View>
                            {profile.account_type === 'empresa' && (
                              <>
                                <Text style={styles.role}>{service.is_active ? 'Visível para clientes' : 'Pausado'}</Text>
                                <Button secondary disabled={busy}
                                  label={service.is_active ? 'Pausar serviço' : 'Reativar serviço'}
                                  onPress={() => toggleService(service)} />
                              </>
                            )}
                            {profile.account_type === 'cliente' && (
                              <Button label="Reservar horário" onPress={() => { setSelectedService(service); setSelectedDate(''); setSelectedHour(''); }} />
                            )}
                          </View>
                        ))}
                        {profile.account_type === 'cliente' && selectedService && (
                          <View style={styles.card}>
                            <Text style={styles.cardTitle}>Agendar: {selectedService.name}</Text>
                            <Text style={styles.muted}>{selectedService.companies?.display_name || ''}</Text>
                            {selectedService.companies &&
                              <Text style={styles.addressText}>{companyAddress(selectedService.companies)}</Text>
                            <Text style={styles.muted}>Escolha uma data e um horário no fuso do seu celular.</Text>
                            <Text style={styles.fieldLabel}>Escolha a data</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorStrip}>
                              {availableDates.map((date) => (
                                <TouchableOpacity key={date.key}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: selectedDate === date.key }}
                                  onPress={() => { setSelectedDate(date.key); setSelectedHour(''); }}
                                  style={[styles.timeChip, selectedDate === date.key && styles.timeChipActive]}>
                                  <Text style={styles.timeChipText}>{date.label}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                            <Text style={styles.fieldLabel}>Escolha o horário</Text>
                            <View style={styles.timeGrid}>
                              {appointmentHours.map((hour) => (
                                <TouchableOpacity key={hour}
                                  disabled={!selectedDate}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: selectedHour === hour, disabled: !selectedDate }}
                                  onPress={() => setSelectedHour(hour)}
                                  style={[styles.timeChip, selectedHour === hour && styles.timeChipActive,
                                    !selectedDate && styles.disabled]}>
                                  <Text style={styles.timeChipText}>{hour}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <Text style={styles.muted}>Estes são horários de preferência, não disponibilidade confirmada. A empresa confirmará a solicitação. Horários ocupados são bloqueados automaticamente.</Text>
                            <Button label={busy ? 'Agendando...' : 'Confirmar solicitação'} disabled={busy || !selectedDate || !selectedHour} onPress={book} />
                            <Button secondary label="Cancelar escolha" onPress={() => setSelectedService(null)} />
                          </View>
                        )}
                      </>
                    )}

                    {tab === 'perfil' && (
                      <View style={styles.card}>
                        <Text style={styles.eyebrow}>MINHA CONTA</Text>
                        <Text style={styles.cardTitle}>Meu perfil</Text>
                        <View style={styles.profileHero}>
                          <View style={styles.avatarCircle}>
                            {avatarUrl
                              ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                              : <UserCircle2 color="#f2ca92" size={56} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bannerTitle}>{profile.full_name}</Text>
                            <Text style={styles.muted}>{session.user.email || 'E-mail não informado'}</Text>
                            <Button label={busy ? 'Salvando foto...' : 'Alterar foto'} secondary
                              disabled={busy} onPress={uploadAvatar} />
                          </View>
                        </View>
                        <Field label="Nome completo" value={profileName} onChangeText={setProfileName} />
                        <Field label="Telefone" value={profilePhone} onChangeText={setProfilePhone}
                          keyboardType="phone-pad" placeholder="Seu telefone" />
                        <Text style={styles.muted}>Conta: {profile.account_type === 'empresa' ? 'Empresa' : 'Cliente'}</Text>
                        <Button label={busy ? 'Salvando...' : 'Salvar meus dados'} onPress={saveMyProfile} disabled={busy} />
                        <View style={styles.profileStats}>
                          <View style={styles.statBox}>
                            <Text style={styles.statNumber}>{bookings.length}</Text>
                            <Text style={styles.statLabel}>Agendamentos</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statNumber}>{pendingCount}</Text>
                            <Text style={styles.statLabel}>Pendentes</Text>
                          </View>
                        </View>
                        <Button label="Ver meus agendamentos" secondary onPress={() => setTab('agenda')} />
                        {profile.account_type === 'empresa' && company && (
                          <View style={styles.addressEditor}>
                            <Text style={styles.sectionTitle}>Endereço do estabelecimento</Text>
                            <Text style={styles.muted}>O endereço ficará visível para quem pesquisar por seus serviços. Use apenas o endereço comercial que deseja divulgar.</Text>
                            {renderAddressFields()}
                            <Button label={busy ? 'Salvando...' : 'Salvar endereço'} disabled={busy} onPress={saveCompanyAddress} />
                            {!!companyAddress(company) &&
                              <Button label="Conferir no Google Maps" secondary onPress={() => openCompanyMap(company)} />}
                          </View>
                        )}
                      </View>
                    )}
                    {tab === 'agenda' && (
                      <>
                        <Text style={styles.sectionTitle}>Seus agendamentos</Text>
                        {bookings.length === 0 && <Text style={styles.muted}>Nenhum agendamento registrado ainda.</Text>}
                        {bookings.map((booking) => (
                          <View key={booking.id} style={styles.card}>
                            <Text style={styles.cardTitle}>{booking.services?.name || 'Serviço'}</Text>
                            {booking.companies && <Text style={styles.muted}>{booking.companies.display_name}</Text>}
                            <View style={styles.bookingTime}>
                              <CalendarDays color="#ddb177" size={17} />
                              <Text style={styles.date}>{time(booking.starts_at)}</Text>
                            </View>
                            <View style={[styles.statusPill, booking.status === 'confirmed' && styles.statusConfirmed,
                              booking.status === 'cancelled' && styles.statusCancelled,
                              booking.status === 'completed' && styles.statusCompleted]}>
                              <CheckCircle2 color="#fae2bd" size={13}/>
                              <Text style={styles.statusText}>{statusLabel[booking.status]}</Text>
                            </View>
                            {profile.account_type === 'empresa' && <Text style={styles.muted}>Cliente: {booking.client_name || 'Não informado'}</Text>}
                            {profile.account_type === 'cliente' && (booking.status === 'pending' || booking.status === 'confirmed') &&
                              <Button secondary label="Cancelar agendamento" disabled={busy} onPress={() => changeBookingStatus(booking.id, 'cancelled')} />}
                            {profile.account_type === 'empresa' && booking.status === 'pending' && (
                              <View>
                                <Button label="Confirmar" disabled={busy} onPress={() => changeBookingStatus(booking.id, 'confirmed')} />
                                <Button secondary label="Recusar / cancelar" disabled={busy} onPress={() => changeBookingStatus(booking.id, 'cancelled')} />
                              </View>
                            )}
                            {profile.account_type === 'empresa' && booking.status === 'confirmed' && (
                              <View>
                                <Button label="Marcar como concluído" disabled={busy} onPress={() => changeBookingStatus(booking.id, 'completed')} />
                                <Button secondary label="Cancelar" disabled={busy} onPress={() => changeBookingStatus(booking.id, 'cancelled')} />
                              </View>
                            )}
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        <Text style={styles.footer}>Agenda+ · Versão 0.3.0 de testes</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  successCircle: { width: 70, height: 70, borderRadius: 35, alignItems: 'center',
    justifyContent: 'center', marginBottom: 18, backgroundColor: '#6e4d30' },
  searchEmpty: { borderWidth: 1, borderColor: '#72513b', borderStyle: 'dashed',
    paddingHorizontal: 22, paddingVertical: 32, borderRadius: 20, alignItems: 'center', gap: 12, marginBottom: 20 },
  emptyTitle: { color: '#fff8ee', fontSize: 18, fontWeight: '700' },
  loadingInline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  addressCard: { backgroundColor: '#38251d', padding: 14, borderRadius: 13,
    flexDirection: 'row', gap: 10, marginTop: 8 },
  addressText: { color: '#e0c9b4', fontSize: 13, lineHeight: 19 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  profileHero: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 14, marginBottom: 20 },
  avatarCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#61432e',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 92, height: 92 },
  profileStats: { flexDirection: 'row', gap: 10, marginTop: 20 },
  statBox: { backgroundColor: '#5a3e2c', flex: 1, borderRadius: 14, padding: 15, alignItems: 'center' },
  statNumber: { fontSize: 25, fontWeight: '800', color: '#f3d3a5' },
  statLabel: { fontSize: 12, color: '#e6cead', marginTop: 5 },
  addressEditor: { borderTopWidth: 1, borderTopColor: '#74513a', paddingTop: 22, marginTop: 23 },
  eyebrow: { color: '#eac18b', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, borderRadius: 50,
    backgroundColor: 'rgba(242,194,137,0.09)', paddingHorizontal: 17, paddingVertical: 10 },
  heroLineText: { color: '#e6c5a2', fontSize: 12, fontWeight: '600' },
  dashboardBanner: { flexDirection: 'row', alignItems: 'center', padding: 19, borderRadius: 22,
    backgroundColor: '#5b3826', borderWidth: 1, borderColor: '#98673e', marginBottom: 18, gap: 13 },
  bannerIcon: { width: 51, height: 51, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#754b2d' },
  bannerCopy: { flex: 1 },
  bannerTitle: { color: '#fff5e6', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  bannerDetail: { color: '#e6c6a7', fontSize: 12, lineHeight: 18 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#482e22',
    borderWidth: 1, borderColor: '#826046', borderRadius: 15, paddingHorizontal: 15,
    minHeight: 53, marginBottom: 17 },
  searchInput: { flex: 1, color: '#fff8ee', paddingVertical: 12, fontSize: 15 },
  serviceHeader: { flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 7 },
  serviceIcon: { backgroundColor: '#6c482f', width: 47, height: 47, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center' },
  serviceTitleWrap: { flex: 1 },
  serviceMeta: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 8, marginBottom: 5 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#603f2c', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 50 },
  infoText: { color: '#f2ddc5', fontSize: 12, fontWeight: '600' },
  bookingTime: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
  statusPill: { flexDirection: 'row', alignSelf: 'flex-start', gap: 7, borderRadius: 50,
    backgroundColor: '#78552f', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  statusConfirmed: { backgroundColor: '#3b6d53' },
  statusCancelled: { backgroundColor: '#734544' },
  statusCompleted: { backgroundColor: '#426b73' },
  statusText: { color: '#fff4e5', fontSize: 12, fontWeight: '700' },
  inputRow: { position: 'relative' },
  passwordInput: { paddingRight: 60 },
  passwordToggle: { position: 'absolute', top: 0, bottom: 0, right: 3, width: 50,
    justifyContent: 'center', alignItems: 'center' },
  selectorStrip: { marginTop: 10, marginBottom: 18 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
  timeChip: { borderWidth: 1, borderColor: '#926845', paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 9, backgroundColor: '#453020', marginRight: 8 },
  timeChipActive: { backgroundColor: '#986c40', borderColor: '#e4b77c' },
  timeChipText: { color: '#fff1df', fontSize: 13, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#2a1c18' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 23, paddingBottom: 46 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  brand: { alignItems: 'center', marginBottom: 28, marginTop: 18 },
  logo: { width: 76, height: 76, borderRadius: 38, borderColor: '#aa7f50', borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#50321f', marginBottom: 12 },
  title: { fontSize: 46, fontWeight: '300', color: '#fff9ed', letterSpacing: 2 },
  plus: { color: '#e1ae69' },
  titleSmall: { fontSize: 33, fontWeight: '400', color: '#fff9ed' },
  subtitle: { fontSize: 19, color: '#d8a566' },
  description: { color: '#e1d2c2', textAlign: 'center', marginTop: 15, lineHeight: 23, maxWidth: 280 },
  card: { backgroundColor: '#422b22', borderWidth: 1, borderColor: '#654832', borderRadius: 21, padding: 19, marginBottom: 15 },
  cardTitle: { color: '#fff8ee', fontSize: 18, fontWeight: '700', marginBottom: 7 },
  muted: { color: '#dac6af', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  button: { backgroundColor: '#e4b77c', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 15, alignItems: 'center', marginTop: 12, elevation: 1 },
  buttonText: { color: '#26170f', fontSize: 15, fontWeight: '700' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#c18b50' },
  buttonOutlineText: { color: '#f8e8d3' },
  disabled: { opacity: 0.5 },
  field: { marginTop: 11 },
  fieldLabel: { color: '#f5e8d7', fontSize: 13, marginBottom: 6 },
  input: { borderColor: '#7b5842', borderWidth: 1, borderRadius: 13, backgroundColor: '#33221c', color: '#fff7ed', padding: 15, fontSize: 15, minHeight: 52 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 7 },
  link: { color: '#e4b77c' },
  row: { flexDirection: 'row', gap: 10, marginTop: 13, marginBottom: 10 },
  choice: { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 9, borderRadius: 12, borderWidth: 1, borderColor: '#795438' },
  choiceActive: { borderColor: '#e4b77c', backgroundColor: '#6b492d' },
  choiceText: { color: '#fff2e2', fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  headerActions: { flexDirection: 'row', gap: 20, paddingTop: 14 },
  role: { color: '#e9b978', fontWeight: '600', marginBottom: 8 },
  tabRow: { flexDirection: 'row', marginBottom: 18, gap: 9 },
  tab: { flex: 1, alignItems: 'center', backgroundColor: '#422b22', borderRadius: 13, paddingVertical: 15, borderWidth: 1, borderColor: '#74513a' },
  tabSelected: { backgroundColor: '#84552e', borderColor: '#e6ad6f' },
  tabText: { color: '#fff4e3', fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 20, color: '#fff4e3', fontWeight: '700', marginBottom: 13 },
  price: { fontSize: 20, fontWeight: '800', color: '#f3c78c' },
  date: { fontSize: 15, fontWeight: '600', color: '#fff1df' },
  footer: { marginTop: 25, textAlign: 'center', color: '#aa927d', fontSize: 12 },
});
