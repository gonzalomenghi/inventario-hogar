import { LinearGradient } from 'expo-linear-gradient';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { BarChart3, Home, LucideIcon, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Text, View, StyleSheet, useWindowDimensions } from 'react-native';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { useAuth } from '../../hooks/useAuth';

const DESKTOP_BREAKPOINT = 768;
const MAX_CONTENT_WIDTH = 860;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  return (
    <Tabs>
      {/*
        La tab bar es position: absolute (flota encima del contenido) —
        arriba centrada en desktop, abajo en mobile (ver CustomTabList). El
        contenido de cada pantalla necesita padding para no quedar tapado
        (y sus clicks interceptados) por la tab bar.
      */}
      <TabSlot
        style={{
          height: '100%',
          paddingTop: isDesktop ? 76 : 0,
          paddingBottom: isDesktop ? 0 : 90,
        }}
      />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton Icon={Home} labelCorto="Inventario" labelCompleto="Inventario" />
          </TabTrigger>
          <TabTrigger name="modo-supermercado" href="/modo-supermercado" asChild>
            <TabButton Icon={ShoppingCart} labelCorto="Súper" labelCompleto="Supermercado" />
          </TabTrigger>
          <TabTrigger name="historial" href="/historial" asChild>
            <TabButton Icon={BarChart3} labelCorto="Ahorro" labelCompleto="Historial" />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  Icon,
  labelCorto,
  labelCompleto,
  isFocused,
  ...props
}: TabTriggerSlotProps & {
  Icon: LucideIcon;
  labelCorto: string;
  labelCompleto: string;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      {...props}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.tabButton,
        isFocused && styles.tabButtonActivo,
        !isFocused && hovered && styles.tabButtonHover,
      ]}
    >
      <Icon size={17} color={isFocused ? Colors.primary : Colors.textSecondary} strokeWidth={2.75} />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActivo]}>
        {isDesktop ? labelCompleto : labelCorto}
      </Text>
    </Pressable>
  );
}

// Mobile: pill flotante abajo con degradado transparent→fondo debajo (así
// el contenido que scrollea se desvanece en vez de cortar de golpe).
// Desktop (≥768px): pill arriba centrada con marca + avatar, como antes.
function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { session } = useAuth();
  // Sin campo de nombre en el perfil (solo email) — inicial simple en vez
  // de inventar dos iniciales que no existen.
  const inicial = session?.user.email?.[0]?.toUpperCase() ?? '?';

  if (!isDesktop) {
    return (
      <LinearGradient
        colors={['transparent', Colors.background]}
        locations={[0, 0.4]}
        style={styles.mobileContainer}
        pointerEvents="box-none"
      >
        <View style={styles.mobilePill}>{props.children}</View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.desktopContainer}>
      <View style={styles.desktopPill}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/logo.png')} style={styles.brandLogo} />
          <Text style={styles.brandText}>
            Alacena<Text style={styles.brandTextAcento}>App</Text>
          </Text>
        </View>

        <View style={styles.desktopTabs}>{props.children}</View>

        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>{inicial}</Text>
        </View>
      </View>
    </View>
  );
}

const sombraTabBar = {
  shadowColor: '#2a1e1a',
  shadowOpacity: 0.14,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  mobileContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  mobilePill: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 999,
    padding: 6,
    gap: 4,
    ...sombraTabBar,
  },
  desktopContainer: {
    position: 'absolute',
    width: '100%',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  desktopPill: {
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: 16,
    maxWidth: MAX_CONTENT_WIDTH,
    ...sombraTabBar,
  },
  desktopTabs: { flexDirection: 'row', gap: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 'auto' },
  brandLogo: { width: 24, height: 24 },
  brandText: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.textPrimary },
  brandTextAcento: { color: Colors.primary },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarTexto: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.primary },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  tabButtonActivo: { backgroundColor: Colors.primaryTint },
  tabButtonHover: { backgroundColor: Colors.background },
  tabLabel: { fontFamily: Fonts.semibold, fontSize: 13, color: Colors.textSecondary },
  tabLabelActivo: { fontFamily: Fonts.bold, color: Colors.primary },
});
