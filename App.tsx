import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import AddPropertyScreen from "./src/screens/AddPropertyScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PropertyDetailScreen from "./src/screens/PropertyDetailScreen";
import SignInScreen from "./src/screens/SignInScreen";
import { loadAccess } from "./src/storage";

// Tier 1 keeps routing absurdly simple — four screens, one state machine.
// Adding expo-router can wait until we have ≥6 screens or deep links.
type Screen =
  | { name: "loading" }
  | { name: "sign-in" }
  | { name: "home" }
  | { name: "add" }
  | { name: "detail"; propertyId: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  // Bumped whenever a downstream action (create, status change, archive) needs
  // Home to refetch on its next mount.
  const [reloadKey, setReloadKey] = useState(0);

  // On boot, peek at AsyncStorage. If we already have a JWT, skip sign-in.
  useEffect(() => {
    (async () => {
      const access = await loadAccess();
      setScreen(access ? { name: "home" } : { name: "sign-in" });
    })();
  }, []);

  return (
    <View style={styles.root}>
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
          onAddProperty={() => setScreen({ name: "add" })}
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
