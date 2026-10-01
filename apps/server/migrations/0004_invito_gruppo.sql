-- Sessione 5: un invito può valere per più persone (link unico da mandare nel gruppo). Chi apre il link scrive il nome e il server
-- crea la sua persona con il primo slot libero. `usi` conta gli ingressi, oltre `max_usi` il link non fa più entrare nessuno.
ALTER TABLE inviti ADD COLUMN max_usi INTEGER NOT NULL DEFAULT 1;
ALTER TABLE inviti ADD COLUMN usi INTEGER NOT NULL DEFAULT 0;
