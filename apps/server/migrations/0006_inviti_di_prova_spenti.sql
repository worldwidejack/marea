-- Gli inviti di prova di Riccardo erano scritti nel codice, che è pubblico: quelli non ancora usati non fanno più entrare nessuno.
-- Chi è già entrato con uno di questi resta com'è.
DELETE FROM inviti WHERE creato_da = 'riccc' AND usi < max_usi;
