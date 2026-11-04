import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardTypeOptions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { CalendarDays, Building2, UserRound, ArrowLeft, LogOut, RefreshCw } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

type AccountType = 'cliente' | 'empresa';
type Page = 'inicio' | 'login' | 'cadastro';
type Tab = 'servicos' | 'agenda';
type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  account_type: AccountType;
};
type Company = { id: string; display_name: string; category: string };
type Service = {
  id: string;
  company_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
  companies?: { display_name: string } | null;
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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#95806b"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
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
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [availableDates] = useState(upcomingDates);

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
      .from('profiles').select('id,full_name,phone,account_type')
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
        .select('id,full_name,phone,account_type').single();
      if (createdError) throw createdError;
      nextProfile = created as Profile;
    }
    setProfile(nextProfile);

    if (nextProfile.account_type === 'empresa') {
      const { data: owned, error: companyError } = await supabase
        .from('companies').select('id,display_name,category')
        .eq('owner_id', user.id).maybeSingle();
      if (companyError) throw companyError;
      const nextCompany = (owned as Company | null) ?? null;
      setCompany(nextCompany);
      if (nextCompany) {
        const [serviceResult, bookingResult] = await Promise.all([
          supabase.from('services').select('id,company_id,name,duration_minutes,price_cents,is_active')
            .eq('company_id', nextCompany.id).order('created_at', { ascending: false }),
          supabase.from('bookings')
            .select('id,service_id,client_id,client_name,starts_at,ends_at,status,services(name)')
            .eq('company_id', nextCompany.id).order('starts_at', { ascending: false }),
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
      const [serviceResult, bookingResult] = await Promise.all([
        supabase.from('services')
          .select('id,company_id,name,duration_minutes,price_cents,is_active,companies(display_name)')
          .eq('is_active', true).order('name'),
        supabase.from('bookings')
          .select('id,service_id,client_id,client_name,starts_at,ends_at,status,services(name),companies(display_name)')
          .eq('client_id', user.id).order('starts_at', { ascending: false }),
      ]);
      if (serviceResult.error) throw serviceResult.error;
      if (bookingResult.error) throw bookingResult.error;
      setServices((serviceResult.data ?? []) as unknown as Service[]);
      setBookings((bookingResult.data ?? []) as unknown as Booking[]);
    }
  }, []);

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
    } catch (e) { Alert.alert('Não foi possível entrar', String((e as Error).message)); }
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
        options: { data: { full_name: name.trim(), phone: phone.trim() || null, account_type: registerType } },
      });
      if (error) throw error;
      setPassword(''); setRepeatPassword('');
      if (!data.session) {
        Alert.alert('Cadastro iniciado', 'Verifique sua caixa de e-mail, confirme a conta e depois faça login.');
        setPage('login');
      } else {
        setPage('inicio');
      }
    } catch (e) { Alert.alert('Erro no cadastro', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function createCompany() {
    if (!session?.user || companyName.trim().length < 2) {
      return Alert.alert('Informe o nome da empresa.');
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('companies').insert({
        owner_id: session.user.id,
        display_name: companyName.trim(),
        category: category.trim() || 'Serviços',
      });
      if (error) throw error;
      setCompanyName(''); setCategory('');
      await loadData(session.user);
      Alert.alert('Empresa cadastrada', 'Agora você já pode cadastrar os seus serviços.');
    } catch (e) { Alert.alert('Erro ao salvar empresa', String((e as Error).message)); }
    finally { setBusy(false); }
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
      const { error } = await supabase.from('services').insert({
        company_id: company.id, name: serviceName.trim(),
        price_cents: Math.round(amount * 100), duration_minutes: minutes,
      });
      if (error) throw error;
      setServiceName(''); setPrice(''); setDuration('30');
      await refreshAfterAction();
      Alert.alert('Serviço cadastrado!');
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
        message.includes('bookings_company_no_overlap') ?
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
      await refreshAfterAction();
    } catch (e) { Alert.alert('Não foi possível atualizar o serviço', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function changeBookingStatus(id: string, status: Status) {
    setBusy(true);
    try {
      const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
      if (error) throw error;
      await refreshAfterAction();
    } catch (e) { Alert.alert('Não foi possível atualizar', String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPage('inicio'); setTab('servicos');
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
              <Text style={styles.description}>Conectando empresas e clientes com praticidade.</Text>
            </View>

            {page === 'inicio' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Bem-vindo(a)!</Text>
                <Text style={styles.muted}>Organize sua agenda ou encontre um serviço e reserve um horário.</Text>
                <Button label="Entrar" onPress={() => setPage('login')} />
                <Button secondary label="Criar conta" onPress={() => setPage('cadastro')} />
              </View>
            )}

            {page === 'login' && (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => setPage('inicio')} style={styles.back}><ArrowLeft color="#e4b77c" size={20} /><Text style={styles.link}>Voltar</Text></TouchableOpacity>
                <Text style={styles.cardTitle}>Entrar na minha conta</Text>
                <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="voce@email.com" />
                <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="Sua senha" />
                <Button label={busy ? 'Entrando...' : 'Entrar'} onPress={login} disabled={busy} />
                <Button label="Ainda não tenho conta" secondary onPress={() => setPage('cadastro')} />
              </View>
            )}

            {page === 'cadastro' && (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => setPage('inicio')} style={styles.back}><ArrowLeft color="#e4b77c" size={20} /><Text style={styles.link}>Voltar</Text></TouchableOpacity>
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
                    <Button label={busy ? 'Salvando...' : 'Cadastrar empresa'} onPress={createCompany} disabled={busy} />
                  </View>
                ) : (
                  <>
                    <View style={styles.tabRow}>
                      <TouchableOpacity style={[styles.tab, tab === 'servicos' && styles.tabSelected]} onPress={() => setTab('servicos')}>
                        <Text style={styles.tabText}>{profile.account_type === 'empresa' ? 'Meus serviços' : 'Buscar serviços'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.tab, tab === 'agenda' && styles.tabSelected]} onPress={() => setTab('agenda')}>
                        <Text style={styles.tabText}>Agendamentos</Text>
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
                        <Text style={styles.sectionTitle}>{profile.account_type === 'empresa' ? 'Serviços cadastrados' : 'Serviços disponíveis'}</Text>
                        {services.length === 0 && <Text style={styles.muted}>Nenhum serviço disponível ainda. Atualize para verificar novamente.</Text>}
                        {services.map((service) => (
                          <View key={service.id} style={styles.card}>
                            <Text style={styles.cardTitle}>{service.name}</Text>
                            {service.companies && <Text style={styles.muted}>{service.companies.display_name}</Text>}
                            <Text style={styles.price}>{money(service.price_cents)}</Text>
                            <Text style={styles.muted}>{service.duration_minutes} minutos</Text>
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

                    {tab === 'agenda' && (
                      <>
                        <Text style={styles.sectionTitle}>Seus agendamentos</Text>
                        {bookings.length === 0 && <Text style={styles.muted}>Nenhum agendamento registrado ainda.</Text>}
                        {bookings.map((booking) => (
                          <View key={booking.id} style={styles.card}>
                            <Text style={styles.cardTitle}>{booking.services?.name || 'Serviço'}</Text>
                            {booking.companies && <Text style={styles.muted}>{booking.companies.display_name}</Text>}
                            <Text style={styles.date}>{time(booking.starts_at)}</Text>
                            <Text style={styles.role}>Status: {statusLabel[booking.status]}</Text>
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
        <Text style={styles.footer}>Agenda+ · Versão 0.2.0 de desenvolvimento</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  selectorStrip: { marginTop: 10, marginBottom: 18 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 16 },
  timeChip: { borderWidth: 1, borderColor: '#926845', paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 9, backgroundColor: '#453020', marginRight: 8 },
  timeChipActive: { backgroundColor: '#986c40', borderColor: '#e4b77c' },
  timeChipText: { color: '#fff1df', fontSize: 13, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#382317' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  brand: { alignItems: 'center', marginBottom: 28, marginTop: 18 },
  logo: { width: 76, height: 76, borderRadius: 38, borderColor: '#aa7f50', borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#50321f', marginBottom: 12 },
  title: { fontSize: 46, fontWeight: '300', color: '#fff9ed', letterSpacing: 2 },
  plus: { color: '#e1ae69' },
  titleSmall: { fontSize: 33, fontWeight: '400', color: '#fff9ed' },
  subtitle: { fontSize: 19, color: '#d8a566' },
  description: { color: '#e1d2c2', textAlign: 'center', marginTop: 15, lineHeight: 23, maxWidth: 280 },
  card: { backgroundColor: '#50321f', borderWidth: 1, borderColor: '#795438', borderRadius: 18, padding: 18, marginBottom: 15 },
  cardTitle: { color: '#fff8ee', fontSize: 19, fontWeight: '700', marginBottom: 10 },
  muted: { color: '#dac6af', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  button: { backgroundColor: '#d4a263', paddingVertical: 14, paddingHorizontal: 15, borderRadius: 10, alignItems: 'center', marginTop: 13 },
  buttonText: { color: '#26170f', fontSize: 15, fontWeight: '700' },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#c18b50' },
  buttonOutlineText: { color: '#f8e8d3' },
  disabled: { opacity: 0.5 },
  field: { marginTop: 11 },
  fieldLabel: { color: '#f5e8d7', fontSize: 13, marginBottom: 6 },
  input: { borderColor: '#896343', borderWidth: 1, borderRadius: 9, backgroundColor: '#3c291e', color: '#fff7ed', padding: 13, fontSize: 15 },
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
  tab: { flex: 1, alignItems: 'center', backgroundColor: '#50321f', borderRadius: 9, paddingVertical: 14 },
  tabSelected: { backgroundColor: '#986c40' },
  tabText: { color: '#fff4e3', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 20, color: '#fff4e3', fontWeight: '700', marginBottom: 13 },
  price: { fontSize: 18, fontWeight: '700', color: '#f3c78c', marginTop: 6, marginBottom: 7 },
  date: { fontSize: 16, fontWeight: '600', color: '#fff1df', marginBottom: 8 },
  footer: { marginTop: 25, textAlign: 'center', color: '#aa927d', fontSize: 12 },
});
