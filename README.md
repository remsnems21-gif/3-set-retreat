# 3 SET RETREAT – Partner-App und Team-Pendenzen

Web-App für das 3 SET RETREAT (Padel · Kraft · Erholung), zweisprachig FR/DE.

- **Öffentlich:** Projekt-Pitch für Padelhallen, Hotels und Sponsoren (Programm, Teilnehmende, Markt, Partnerschaft, Team). Keine internen Zahlen.
- **Nur Team (Login):** gemeinsame Pendenzliste, live aktualisiert, mit Status, Verantwortlichen, Fälligkeit, Priorität und «Neu seit deinem letzten Besuch».

Die Pendenzen liegen in Supabase (Projekt `3-set-retreat`, Region Zürich), nicht in diesem Repository.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `site/index.html` | Die ganze App (Pitch und Team-Bereich) |
| `site/team.js` | Login und Pendenzliste (Supabase) |
| `site/supabase-config.js` | Projekt-URL und öffentlicher Browser-Schlüssel |
| `supabase/setup.sql` | Tabellen, Rechte (RLS), Realtime |
| `.github/workflows/pages.yml` | Veröffentlichung auf GitHub Pages bei jedem Push auf `main` |

Der Schlüssel in `supabase-config.js` ist der öffentliche «publishable key». Er ist kein Geheimnis. Daten sehen nur angemeldete **und** freigeschaltete Team-Mitglieder (Row Level Security). Niemals den `service_role`- oder `secret`-Schlüssel ins Repository legen.

## Einrichtung

### 1. GitHub Pages

Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**. Danach veröffentlicht jeder Push auf `main` die App unter `https://<github-name>.github.io/<repo>/`.

### 2. Supabase-Login

Im Supabase-Dashboard des Projekts `3-set-retreat`:

1. **Authentication → URL Configuration:** «Site URL» und «Redirect URLs» auf die GitHub-Pages-Adresse setzen (z. B. `https://remsnems21-gif.github.io/3-set-retreat/`). Nötig für Einladungs- und Passwort-Mails.
2. **Authentication → Sign In / Providers:** «Allow new users to sign up» **ausschalten**. E-Mail/Passwort eingeschaltet lassen, Mindestlänge 10 oder mehr.
3. **Authentication → Users → Add user → Send invitation** für Rémy, Mathieu und Mel. Der Einladungslink führt in die App, dort wird das Passwort gesetzt. (Der Standard-Mailversand von Supabase ist auf wenige Mails pro Stunde begrenzt. Alternativ: «Create new user» mit Passwort und dieses persönlich weitergeben.)
4. Jedes Konto im **SQL Editor** freischalten (ein Konto allein gibt noch keinen Zugriff):

   ```sql
   insert into public.retreat_members (user_id, display_name)
   select id, 'Mathieu' from auth.users where lower(email) = lower('E-MAIL-HIER')
   on conflict (user_id) do update set display_name = excluded.display_name;
   ```

   `display_name` muss genau `Rémy`, `Mathieu` oder `Mel` sein (damit «Meine Pendenzen» funktioniert).

   Zugriff entziehen:

   ```sql
   delete from public.retreat_members
   where user_id in (select id from auth.users where lower(email) = lower('E-MAIL-HIER'));
   ```

Row Level Security nie ausschalten und keine öffentlichen Lese- oder Schreibrechte hinzufügen.

## Bedienung

- Sprache FR/DE und Partnertyp (Padelhalle, Hotel, Sponsor) in der Seitenleiste bzw. im Menü.
- «Mode présentation / Präsentationsmodus» blendet den internen Teil aus; Pfeiltasten blättern.
- Pendenzen: Status direkt in der Liste ändern, Titel antippen zum Bearbeiten, «+ Nouvelle tâche» zum Hinzufügen. Änderungen der anderen erscheinen live; neue, geänderte und erledigte Einträge seit dem letzten Besuch sind markiert.
