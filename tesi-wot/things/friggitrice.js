module.exports = async function registerFriggitrice(WoT, HASS_URL, HASS_TOKEN) {
  const friggitrice = await WoT.produce({
    title: "smartplug_friggitrice",
    description: "Presa friggitrice ad aria",
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
      priority: 3,
      deferrable: true
    }
  });

  friggitrice.setPropertyReadHandler("status", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/switch.friggitrice_ad_aria`, { 
        headers: { Authorization: `Bearer ${HASS_TOKEN}` } 
      });
      if (!res.ok) return "off";
      const data = await res.json();
      return data.state || "off";
    } catch (e) {
      return "off";
    }
  });

  friggitrice.setPropertyReadHandler("power", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/sensor.friggitrice_ad_aria_consumo_di_corrente`, { 
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

  friggitrice.setActionHandler("toggle", async () => {
    try {
      await fetch(`${HASS_URL}/api/services/switch/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: "switch.friggitrice_ad_aria" })
      });
    } catch (e) {
      console.error("Errore nel toggle della friggitrice:", e.message);
    }
    return { success: true };
  });

  await friggitrice.expose();
  console.log("Esposta: SmartPlug_Friggitrice");
};