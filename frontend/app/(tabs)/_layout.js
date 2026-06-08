import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import * as engineService from '../../src/api/engineService';
import useFarmStore from '../../src/store/farmStore';
import { Colors } from '../../src/constants/colors';

// ── Badge overlay ─────────────────────────────────────────────────────
function AlertBadge({ count, color, focused }) {
  if (!count) return null;
  return (
    <View style={[badge.wrap, { backgroundColor: Colors.alertCritical }]}>
      <Text style={badge.text}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

function AlertsIcon({ color, size, focused }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetch = () => {
      engineService.getAlerts()
        .then((data) => {
          if (!cancelled && Array.isArray(data)) {
            setUnread(data.filter((a) => !a.is_read).length);
          }
        })
        .catch(() => {});
    };
    fetch();
    const id = setInterval(fetch, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <View>
      <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
      <AlertBadge count={unread} />
    </View>
  );
}

// ── Active farm/plot footer strip ──────────────────────────────────────
function ActiveFarmStrip() {
  const { activeFarm, activePlot } = useFarmStore();
  if (!activeFarm) return null;

  const label = activePlot
    ? `${activeFarm.name}  —  ${activePlot.name}`
    : activeFarm.name;

  return (
    <View style={strip.bar}>
      <Text style={strip.text} numberOfLines={1}>📍 {label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:   Colors.tabActive,
          tabBarInactiveTintColor: Colors.tabInactive,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#F0F0F0',
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? 20 : 8,
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 82 : 64,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 12,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarActiveBackgroundColor: 'transparent',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="farms"
          options={{
            title: 'Farms',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'leaf' : 'leaf-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size, focused }) => (
              <AlertsIcon color={color} size={size} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="market"
          options={{
            title: 'Market',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'trending-up' : 'trending-up-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <ActiveFarmStrip />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const badge = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  text: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});

const strip = StyleSheet.create({
  bar: {
    backgroundColor: '#0E3D22',
    paddingVertical: 5,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  text: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500', letterSpacing: 0.2 },
});
