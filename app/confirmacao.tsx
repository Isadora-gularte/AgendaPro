import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, AlertCircle, CalendarDays } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

type ConfirmationState = 'loading' | 'success' | 'error';
function parameter(url: string, key: string): string | undefined {
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const item of part.split('&')) {
      const equal = item.indexOf('=');
      if (equal < 0 || item.slice(0, equal) !== key) continue;
      try { return decodeURIComponent(item.slice(equal + 1).replace(/\+/g, ' ')); }
      catch { return undefined; }
    }
  }
  return undefined;
}

export default function Confirmation() {
  const [state, setState] = useState<ConfirmationState>('loading');
  const [description, setDescription] = useState('Estamos verificando a confirmação da sua conta.');
  useEffect(() => {
    let alive = true;
    let processed = false;
    const finish = async (url: string | null) => {
      if (!alive || processed || !url) return;
      processed = true;
      try {
        const error = parameter(url, 'error_description') || parameter(url, 'error');
        if (error) throw new Error(error);
        const access = parameter(url, 'access_token');
        const refresh = parameter(url, 'refresh_token');
        const code = parameter(url, 'code');
        if (access && refresh) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: access, refresh_token: refresh,
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('O link não contém uma confirmação válida. Ele pode ter expirado ou já ter sido utilizado.');
        }
        if (alive) {
          setState('success');
          setDescription('Seu e-mail foi confirmado! Você já pode entrar no Agenda+.');
        }
      } catch (e) {
        if (alive) {
          setState('error');
          setDescription(String((e as Error).message || 'Não foi possível confirmar o e-mail.'));
        }
      }
    };
    Linking.getInitialURL().then(finish).catch(() => {
      if (alive) { setState('error'); setDescription('Não foi possível abrir o link de confirmação.'); }
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('confirmacao')) void finish(url);
    });
    return () => { alive = false; subscription.remove(); };
  }, []);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <CalendarDays color="#e4b77c" size={44} />
        {state === 'loading' ? <ActivityIndicator size="large" color="#e4b77c" />
          : state === 'success' ? <CheckCircle2 color="#a3d6b6" size={48} />
            : <AlertCircle color="#f7bd9d" size={48} />}
        <Text style={styles.title}>{state === 'loading' ? 'Confirmando e-mail'
          : state === 'success' ? 'Confirmação concluída!' : 'Confirmação não concluída'}</Text>
        <Text style={styles.description}>{description}</Text>
        {state !== 'loading' && (
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
            <Text style={styles.buttonText}>Ir para o Agenda+</Text>
          </TouchableOpacity>
        )}
        {state === 'error' &&
          <Text style={styles.helper}>Você pode entrar com sua conta se já confirmou o e-mail ou solicitar um novo link na tela de login.</Text>}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2a1c18', justifyContent: 'center', padding: 22 },
  card: { padding: 27, borderRadius: 24, borderColor: '#795438', borderWidth: 1,
    backgroundColor: '#422b22', alignItems: 'center', gap: 18 },
  title: { fontSize: 25, fontWeight: '700', color: '#fff8ee', textAlign: 'center' },
  description: { fontSize: 15, color: '#f1d8bd', lineHeight: 23, textAlign: 'center' },
  helper: { color: '#e1c3a2', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  button: { backgroundColor: '#e4b77c', padding: 16, alignItems: 'center',
    borderRadius: 15, width: '100%' },
  buttonText: { color: '#26170f', fontSize: 16, fontWeight: '700' },
});
