# Step3D — démo du cours (L3 SPS)

- Base de données : l'API REST https://sps-g00.professeurpetitchat.com/api/step3d (voir `config.js`).
  Elle n'est pas dans votre compte Supabase : le MCP `supabase` ne la voit pas, ne l'utilise pas pour ce projet.
  Le site peut lire, ajouter et modifier les événements, pas les supprimer.
- Dépôt : https://github.com/ProfesseurPetitChat/step3d. Chaque `git push` sur `main` met le site en ligne sur
  https://sps-g00-step3d.professeurpetitchat.com (workflow `.github/workflows/deploy.yml`, ne pas le modifier).
- Pour tester : `python -m http.server` dans ce dossier, puis http://localhost:8000.
