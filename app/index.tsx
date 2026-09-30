import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";

import { CalendarDays } from "lucide-react-native";

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

  <View style={styles.iconContainer}>
     <CalendarDays
      size={38}
      color="#b47124"
      strokeWidth={1.5}
      />
  </View>
        {/* Título */}
        <Text style={styles.title}>Agenda</Text>
        <Text style={styles.subtitle}>Cuidado & Organização</Text>

        {/* Descrição */}
        <Text style={styles.description}>
          Conectando empresas e clientes{"\n"}
          com praticidade.
        </Text>

        {/* Botão entrar */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => console.log("Entrar")}
        >
          <Text style={styles.primaryButtonText}>Entrar</Text>
        </TouchableOpacity>

        {/* Botão criar conta */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => console.log("Criar conta")}
        >
          <Text style={styles.secondaryButtonText}>
            Criar conta
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#5a3116",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#5e361c",
    borderWidth: 1,
    borderColor: "#dba96f",
  },

  icon: {
    fontSize: 32,
    color: "#dbaa72",
  },

  title: {
    fontSize: 42,
    color: "#F5F1E6",
    fontWeight: "300",
    letterSpacing: 2,
  },

  subtitle: {
    fontSize: 24,
    color: "#c79750",
    marginTop: -5,
  },

  description: {
    color: "#C9B9A4",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 25,
    marginBottom: 40,
  },

  primaryButton: {
    width: "45%",
    height: 55,
    backgroundColor: "#a87841ee",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  primaryButtonText: {
    color: "#17110D",
    fontSize: 17,
    fontWeight: "bold",
  },

  secondaryButton: {
    width: "45%",
    height: 55,
    borderWidth: 1,
    borderColor: "#B8854A",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#F5F1E6",
    fontSize: 17,
    fontWeight: "600",
  },
});