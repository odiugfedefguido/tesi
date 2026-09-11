module.exports = async function registerLavatrice(WoT, HASS_URL, HASS_TOKEN) {
  const lavatrice = await WoT.produce({
    title: "smartplug_lavatrice",
    description: "Presa lavatrice",
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
      priority: 2,
      deferrable: true     // Carico differibile (ottimo per il solare)
    }
  });

  lavatrice.setPropertyReadHandler("status", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/switch.lavatrice`, { 
        headers: { Authorization: `Bearer ${HASS_TOKEN}` } 
      });
      if (!res.ok) return "off";
      const data = await res.json();
      return data.state || "off";
    } catch (e) {
      return "off";
    }
  });

  lavatrice.setPropertyReadHandler("power", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/sensor.lavatrice_consumo_di_corrente`, { 
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

  lavatrice.setActionHandler("toggle", async () => {
    try {
      await fetch(`${HASS_URL}/api/services/switch/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: "switch.lavatrice" })
      });
    } catch (e) {
      console.error("Errore nel toggle della lavatrice:", e.message);
    }
    return { success: true };
  });

  await lavatrice.expose();
  console.log("Esposta: SmartPlug_Lavatrice");
};