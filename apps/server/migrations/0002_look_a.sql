-- Look di partenza = variante A scelta da Jack il 30/9 (pelle media, capelli corti neri, vestito acqua, cappello di paglia).
-- Chi ha ancora il vecchio default passa ad A; i nuovi invitati lo ricevono da invita.mjs (il DEFAULT della colonna in SQLite non si cambia senza rifare la tabella).
UPDATE persone SET look = '{"pelle":2,"capelli":0,"coloreCapelli":0,"vestito":0,"cappello":1}'
  WHERE look = '{"pelle":2,"capelli":0,"coloreCapelli":1,"vestito":0,"cappello":0}';
