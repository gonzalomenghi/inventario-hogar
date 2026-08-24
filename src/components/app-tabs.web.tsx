import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Image, Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      {/*
        La tab bar es position: absolute (flota encima del contenido, ver
        tabListContainer más abajo) para lograr el look de pill flotante.
        Eso significa que el contenido de cada pantalla arranca debajo de
        ella en el DOM, así que sin este paddingTop el primer elemento de
        cualquier pantalla queda tapado (y sus clicks interceptados por la
        tab bar) — encontrado originalmente en DashboardAhorroScreen,
        parcheado ahí con un paddingTop local; centralizado acá para que
        ninguna pantalla nueva tenga que repetirlo.
      */}
      <TabSlot style={{ height: '100%', paddingTop: 76 }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Inventario</TabButton>
          </TabTrigger>
          <TabTrigger name="modo-supermercado" href="/modo-supermercado" asChild>
            <TabButton>Supermercado</TabButton>
          </TabTrigger>
          <TabTrigger name="historial" href="/historial" asChild>
            <TabButton>Historial</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/logo.png')} style={styles.brandLogo} />
          <ThemedText type="smallBold" style={styles.brandText}>
            AlacenaApp
          </ThemedText>
        </View>

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginRight: 'auto',
  },
  brandLogo: {
    width: 22,
    height: 22,
  },
  brandText: {},
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
