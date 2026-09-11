module.exports = async function registerAspirapolvere(WoT, HASS_URL, HASS_TOKEN) {
  const aspirapolvere = await WoT.produce({
    title: "smartplug_aspirapolvere",
    description: "Presa aspirapolvere",
    "@context": [
      "https://www.w3.org/2019/wot/td/v1",
      { "hems": "http://example.org/hems-metadata#" }
    ],
    properties: {
      status: { type: "string", readOnly: true },
      power: { type: "number", unit: "W", readOnly: true }
    },
    actions: { toggle: {} },
    "hems:metadata": {
      priority: 4,         // Bassa priorità 
      deferrable: true
    }
  });

  aspirapolvere.setPropertyReadHandler("status", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/switch.aspirapolvere`, { 
        headers: { Authorization: `Bearer ${HASS_TOKEN}` } 
      });
      if (!res.ok) return "off";
      const data = await res.json();
      return data.state || "off";
    } catch (e) {
      return "off";
    }
  });

  aspirapolvere.setPropertyReadHandler("power", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/sensor.aspirapolvere_consumo_di_corrente`, { 
        headers: { Authorization: `Bearer ${HASS_TOKEN}` } 
      });
      if (!res.ok) return 0;
      const data = await res.json();
      const powerVal = parseFloat(data.state);
      return isNaN(powerVal) ? 0 : powerVal;
    } catch (e) {
      return 0;
    }
  });

  aspirapolvere.setActionHandler("toggle", async () => {
    try {
      await fetch(`${HASS_URL}/api/services/switch/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: "switch.aspirapolvere" })
      });
    } catch (e) {
      console.error("Errore nel toggle dell'aspirapolvere:", e.message);
    }
    return { success: true };
  });

  await aspirapolvere.expose();
  console.log("Esposta: SmartPlug_Aspirapolvere");
};