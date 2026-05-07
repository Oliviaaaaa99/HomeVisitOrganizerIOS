// JWT storage helpers. AsyncStorage is the simplest path — values land in
// the iOS app sandbox. M3+ should switch to expo-secure-store / Keychain so
// tokens survive an OS-level malicious-app sweep.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_ACCESS = "hvo.access_token";
const KEY_REFRESH = "hvo.refresh_token";
const KEY_USER_ID = "hvo.user_id";

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

export async function clearTokens() {
  await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH, KEY_USER_ID]);
}
