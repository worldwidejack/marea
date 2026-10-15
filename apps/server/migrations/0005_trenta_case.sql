-- Borgo Marea (#237): le isole personali diventano case in città, 30 per città. Lo slot resta il numero della casa (0-29):
-- chi aveva lo slot 0-7 tiene il suo, i nuovi prendono il primo libero. SQLite non cambia un CHECK: si rifà la tabella.
CREATE TABLE persone_nuova (
  id      TEXT PRIMARY KEY,
  nome    TEXT NOT NULL,
  token   TEXT UNIQUE NOT NULL,
  admin   INTEGER NOT NULL DEFAULT 0,
  look    TEXT NOT NULL DEFAULT '{"pelle":2,"capelli":0,"coloreCapelli":1,"vestito":0,"cappello":0}',
  creato  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultimo_accesso TEXT,
  slot    INTEGER CHECK (slot IS NULL OR (slot BETWEEN 0 AND 29))
);
INSERT INTO persone_nuova (rowid, id, nome, token, admin, look, creato, ultimo_accesso, slot)
  SELECT rowid, id, nome, token, admin, look, creato, ultimo_accesso, slot FROM persone;
DROP TABLE persone;
ALTER TABLE persone_nuova RENAME TO persone;
CREATE UNIQUE INDEX persone_slot ON persone (slot) WHERE slot IS NOT NULL;
-- Chi era arrivato dopo l'ottavo (senza isola) prende ora una casa, in ordine di arrivo.
UPDATE persone SET slot = (
  SELECT 8 + n FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY creato, rowid) - 1 AS n FROM persone WHERE slot IS NULL) AS r WHERE r.id = persone.id AND n < 22
) WHERE slot IS NULL;
