// JWT storage helpers. AsyncStorage is the simplest path — values land in
// the iOS app sandbox. M3+ should switch to expo-secure-store / Keychain so
// tokens survive an OS-level malicious-app sweep.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_ACCESS = "hvo.access_token";
const KEY_REFRESH = "hvo.refresh_token";
const KEY_USER_ID = "hvo.user_id";
const KEY_USER_EMAIL = "hvo.user_email";

export async function saveTokens(access: string, refresh: string, userId: string) {
  await AsyncStorage.multiSet([
    [KEY_ACCESS, access],
    [KEY_REFRESH, refresh],
    [KEY_USER_ID, userId],
  ]);
}

export async function loadAccess(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_ACCESS);
}

export async function loadRefresh(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_REFRESH);
}

export async function loadUserId(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_USER_ID);
}

// Backend stores email_hash, not plaintext, so we stash the email locally at
// sign-in for display (avatar initial, "signed in as …" sheet). Dev-only;
// real OAuth in M3 will pull the display name from the provider's userinfo
// endpoint instead.
export async function saveUserEmail(email: string) {
  await AsyncStorage.setItem(KEY_USER_EMAIL, email);
}

export async function loadUserEmail(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_USER_EMAIL);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([
    KEY_ACCESS,
    KEY_REFRESH,
    KEY_USER_ID,
    KEY_USER_EMAIL,
  ]);
}
