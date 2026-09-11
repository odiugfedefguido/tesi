Architettura WoT e Integrazione Home Assistant: Stato dell'Arte
1. Estrarre le credenziali e gli ID da Home Assistant
Cosa è stato fatto: Configurazione dell'ambiente Home Assistant per l'autenticazione esterna. Generazione di un Long-Lived Access Token sicuro per l'interazione via API REST.
Dettagli tecnici: Mappatura formale di tutti gli Entity ID associati alle 4 prese intelligenti (SmartPlug_Lavatrice, SmartPlug_Friggitrice, SmartPlug_Computer, SmartPlug_Aspirapolvere). Raccolta degli ID relativi allo stato (switch.*), ai consumi di potenza in Watt (sensor.*_consumo_di_corrente) e, per il computer, ai valori fisici di tensione e corrente (sensor.computer_tensione, sensor.computer_corrente).

2. Configurare l'ambiente Node.js con Thingweb
Cosa è stato fatto: Creazione dell'ambiente di runtime ed esecuzione del middleware Web of Things (WoT) basato sul framework standard industriale.
Dettagli tecnici: Setup dell'infrastruttura di progetto Node.js tramite npm con l'installazione delle librerie ufficiali W3C @node-wot/core e @node-wot/binding-http. Configurazione dell'istanza Servient in ascolto sulla porta HTTP 8080.

3. Modellare e validare la Thing Description (TD)
Cosa è stato fatto: Formalizzazione dei dispositivi fisici secondo le specifiche standard W3C WoT in formato JSON-LD e verifica della loro validità formale.
Dettagli tecnici: Modellazione delle Interaction Affordances per ciascun elettrodomestico: definizione delle Properties leggibili (status, power) e delle Actions invocabili (toggle). Validazione formale del documento JSON-LD generato tramite il tool ufficiale W3C Thingweb Playground, confermando la conformità dello schema, dei tipi di dato e dei bindings HTTP.

4. Programmare il Servient Node.js (HA ➔ WoT)
Cosa è stato fatto: Sviluppo del server gateway proxy WoT modulare per l'astrazione dell'hardware.
Dettagli tecnici: Implementazione di una struttura software modulare basata su un file orchestratore (index.js) e file dedicati per ogni dispositivo (things/*.js). Il server espone endpoint WoT standardizzati che intercettano le chiamate HTTP (es. GET /properties/power), effettuano richieste verso l'API REST di Home Assistant usando l'Access Token, calcolano i valori necessari (come la potenza stimata $V \times I$ per il computer) e restituiscono i dati standardizzati ai client WoT.

5. la politica di gestione carichi e l'analisi dei dati in Python