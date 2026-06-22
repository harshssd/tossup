import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClub } from '../../lib/club';
import { Button, Card, Label } from '../../lib/ui';
import { colors, radius, space } from '../../lib/theme';

export default function ClubSelectScreen() {
  const router = useRouter();
  const { clubs, activeClubId, selectClub, addClub } = useClub();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addClub(name.trim());
      router.dismissAll?.();
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pick(id: string) {
    await selectClub(id);
    router.replace('/');
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      {clubs.length > 0 && (
        <Card>
          <Text style={styles.title}>Your clubs</Text>
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            {clubs.map((c) => {
              const active = c.id === activeClubId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => pick(c.id)}
                  style={[styles.clubRow, active && { borderColor: colors.primary, backgroundColor: colors.primaryDim }]}
                >
                  <Text style={styles.clubName}>{c.name}</Text>
                  {active && <Text style={{ color: colors.primary, fontWeight: '800' }}>✓ Active</Text>}
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      <Card>
        <Text style={styles.title}>{clubs.length ? 'Register another club' : 'Register your club'}</Text>
        <Label style={{ marginTop: space.sm }}>Club name</Label>
        <TextInput
          placeholder="e.g. Sunday Warriors CC"
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={setName}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={register}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button
          label={saving ? 'Creating…' : 'Create club'}
          onPress={register}
          disabled={saving || !name.trim()}
          style={{ marginTop: space.md }}
        />
        <Text style={styles.hint}>
          A club holds your roster. Organize players into teams, move them around, and pull them into
          practice sessions.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  clubName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: space.md },
  error: { color: colors.red, marginTop: space.sm },
});
