-- MAREA: schema iniziale. Date in testo ISO-8601 UTC.
CREATE TABLE persone (
  id      TEXT PRIMARY KEY,
  nome    TEXT NOT NULL,
  token   TEXT UNIQUE NOT NULL,
  admin   INTEGER NOT NULL DEFAULT 0,
  look    TEXT NOT NULL DEFAULT '{"pelle":2,"capelli":0,"coloreCapelli":1,"vestito":0,"cappello":0}',
  creato  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ultimo_accesso TEXT
);
CREATE TABLE inviti (
  codice     TEXT PRIMARY KEY,
  creato_da  TEXT NOT NULL,
  usato_da   TEXT,
  creato     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  usato      TEXT
);
