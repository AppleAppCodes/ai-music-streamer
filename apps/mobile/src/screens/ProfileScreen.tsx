import { Alert, ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const PROFANITY_LIST = ['nazi', 'hitler', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'fagot', 'nigger', 'nigga', 'retard'];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Fehler beim Speichern.';
}

function containsProfanity(text: string) {
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some((word) => lower.includes(word));
}

function isLocalImageUri(uri: string) {
  return uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('assets-library:');
}

function getImageExtension(uri: string) {
  const cleanUri = uri.split('?')[0] ?? uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  return extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
}

function getImageContentType(extension: string) {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function ProfileScreen({ navigation }: Props) {
  const { authReady, user, signOut } = useAuth();
  
  const initialUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const initialAvatarUrl = user?.user_metadata?.avatar_url || null;

  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!authReady || !supabase || !user) {
      Alert.alert('Nicht möglich', 'Dein Profil kann gerade nicht gespeichert werden, weil die App nicht verbunden ist.');
      return;
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3) {
      Alert.alert('Benutzername zu kurz', 'Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }

    if (containsProfanity(trimmedUsername)) {
      Alert.alert('Benutzername nicht erlaubt', 'Dieser Benutzername enthält nicht erlaubte Wörter. Bitte wähle einen anderen.');
      return;
    }

    setIsSaving(true);

    try {
      let nextAvatarUrl = avatarUrl;

      if (nextAvatarUrl && isLocalImageUri(nextAvatarUrl)) {
        const extension = getImageExtension(nextAvatarUrl);
        const response = await fetch(nextAvatarUrl);
        const blob = await response.blob();
        const path = `avatars/${user.id}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(path, blob, {
            contentType: getImageContentType(extension),
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('covers')
          .getPublicUrl(path);

        nextAvatarUrl = publicUrlData.publicUrl;
      }

      const profileUpdate: { username: string; avatar_url?: string } = { username: trimmedUsername };
      if (nextAvatarUrl) {
        profileUpdate.avatar_url = nextAvatarUrl;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error('Dieser Benutzername ist leider schon vergeben.');
        }
        throw profileError;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          username: trimmedUsername,
          ...(nextAvatarUrl ? { avatar_url: nextAvatarUrl } : {}),
        },
      });

      if (authError) throw authError;

      setUsername(trimmedUsername);
      setAvatarUrl(nextAvatarUrl);
      Alert.alert('Gespeichert', 'Deine Änderungen wurden erfolgreich gespeichert.');
    } catch (error) {
      Alert.alert('Fehler beim Speichern', getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <View style={styles.headerIconBox}>
              <Ionicons name="settings-outline" size={20} color={theme.colors.text} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Einstellungen</Text>
        </View>
        <TouchableOpacity onPress={() => void signOut()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardBodyRow}>
            <View style={styles.avatarColumn}>
              <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} alt="" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.avatarLabel}>Profilbild</Text>
              <Text style={styles.avatarHint}>Empfohlen: 400x400px</Text>
            </View>

            <View style={styles.formColumn}>
              <Text style={styles.inputLabel}>Benutzername</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={18} color={theme.colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Dein Name"
                  placeholderTextColor={theme.colors.muted}
                />
              </View>

              <Text style={styles.inputLabel}>E-Mail Adresse</Text>
              <View style={styles.inputBoxDisabled}>
                <TextInput
                  style={styles.inputDisabled}
                  value={email}
                  editable={false}
                />
              </View>
              <Text style={styles.inputHint}>Die E-Mail Adresse kann derzeit nicht geändert werden.</Text>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#000" />
                  <Text style={styles.saveButtonText}>Änderungen speichern</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
  },
  logoutButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 14,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    padding: 24,
  },
  cardBodyRow: {
    flexDirection: 'row',
    gap: 32,
  },
  avatarColumn: {
    alignItems: 'center',
    width: 120,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
  },
  avatarLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  avatarHint: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  formColumn: {
    flex: 1,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
  },
  inputBoxDisabled: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
    marginBottom: 8,
  },
  inputDisabled: {
    color: theme.colors.muted,
    fontSize: 15,
  },
  inputHint: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  cardFooter: {
    alignItems: 'flex-end',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    backgroundColor: theme.colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
  },
});
