import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { setOnAuthExpired } from "./src/api";
import { LanguageProvider } from "./src/i18n";
import AddPropertyScreen from "./src/screens/AddPropertyScreen";
import EditPropertyScreen from "./src/screens/EditPropertyScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PreferencesScreen from "./src/screens/PreferencesScreen";
import PropertyDetailScreen from "./src/screens/PropertyDetailScreen";
import RankedScreen from "./src/screens/RankedScreen";
import SignInScreen from "./src/screens/SignInScreen";
import UnitDetailScreen from "./src/screens/UnitDetailScreen";
import { loadAccess } from "./src/storage";

// Tier 1 keeps routing simple — eight screens, one state machine.
// Adding expo-router can wait until we have deep links or back-stacks.
type Screen =
  | { name: "loading" }
  | { name: "sign-in" }
  | { name: "home" }
  | { name: "add" }
  | { name: "detail"; propertyId: string }
  | { name: "edit"; propertyId: string }
  | { name: "unit-detail"; propertyId: string; unitId: string }
  | { name: "ranked" }
  | { name: "preferences"; from: "home" | "ranked" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      const access = await loadAccess();
      setScreen(access ? { name: "home" } : { name: "sign-in" });
    })();
  }, []);

  // The API layer calls this when both access AND refresh have failed.
  // We just kick the user back to sign-in; the screens already alert with
  // "session expired" so the user knows what happened.
  useEffect(() => {
    setOnAuthExpired(() => setScreen({ name: "sign-in" }));
  }, []);

  return (
    <LanguageProvider>
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="auto" />
      {screen.name === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}
      {screen.name === "sign-in" && (
        <SignInScreen onSignedIn={() => setScreen({ name: "home" })} />
      )}
      {screen.name === "home" && (
        <HomeScreen
          reloadKey={reloadKey}
          onOpenProperty={(id) => setScreen({ name: "detail", propertyId: id })}
          onOpenUnit={(propertyId, unitId) =>
            setScreen({ name: "unit-detail", propertyId, unitId })
          }
          onAddProperty={() => setScreen({ name: "add" })}
          onOpenRanked={() => setScreen({ name: "ranked" })}
          onOpenPreferences={() =>
            setScreen({ name: "preferences", from: "home" })
          }
          onSignedOut={() => setScreen({ name: "sign-in" })}
        />
      )}
      {screen.name === "add" && (
        <AddPropertyScreen
          onCancel={() => setScreen({ name: "home" })}
          onCreated={() => {
            setReloadKey((k) => k + 1);
            setScreen({ name: "home" });
          }}
        />
      )}
      {screen.name === "detail" && (
        <PropertyDetailScreen
          propertyId={screen.propertyId}
          onBack={() => {
            setReloadKey((k) => k + 1);
            setScreen({ name: "home" });
          }}
          onEdit={() =>
            setScreen({ name: "edit", propertyId: screen.propertyId })
          }
        />
      )}
      {screen.name === "edit" && (
        <EditPropertyScreen
          propertyId={screen.propertyId}
          onCancel={() =>
            setScreen({ name: "detail", propertyId: screen.propertyId })
          }
          onSaved={() =>
            setScreen({ name: "detail", propertyId: screen.propertyId })
          }
        />
      )}
      {screen.name === "unit-detail" && (
        <UnitDetailScreen
          propertyId={screen.propertyId}
          unitId={screen.unitId}
          onBack={() => {
            setReloadKey((k) => k + 1);
            setScreen({ name: "home" });
          }}
          onViewProperty={() =>
            setScreen({ name: "detail", propertyId: screen.propertyId })
          }
        />
      )}
      {screen.name === "ranked" && (
        <RankedScreen
          onBack={() => setScreen({ name: "home" })}
          onOpenUnit={(propertyId, unitId) =>
            setScreen({ name: "unit-detail", propertyId, unitId })
          }
          onOpenPreferences={() =>
            setScreen({ name: "preferences", from: "ranked" })
          }
        />
      )}
      {screen.name === "preferences" && (
        <PreferencesScreen
          onBack={() =>
            setScreen(
              screen.from === "ranked"
                ? { name: "ranked" }
                : { name: "home" },
            )
          }
        />
      )}
    </GestureHandlerRootView>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
