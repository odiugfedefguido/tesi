module.exports = async function registerAspirapolvere(WoT, HASS_URL, HASS_TOKEN) {
  const aspirapolvere = await WoT.produce({
    title: "SmartPlug_Aspirapolvere",
    description: "Presa aspirapolvere",
    "@context": "https://www.w3.org/2019/wot/td/v1",
    properties: {
      status: { type: "string", readOnly: true },
      power: { type: "number", unit: "W", readOnly: true }
    },
    actions: { toggle: {} }
  });

  aspirapolvere.setPropertyReadHandler("status", async () => {
    const res = await fetch(`${HASS_URL}/api/states/switch.aspirapolvere`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return (await res.json()).state;
  });

  aspirapolvere.setPropertyReadHandler("power", async () => {
    const res = await fetch(`${HASS_URL}/api/states/sensor.aspirapolvere_consumo_di_corrente`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return parseFloat((await res.json()).state) || 0;
  });

  aspirapolvere.setActionHandler("toggle", async () => {
    await fetch(`${HASS_URL}/api/services/switch/toggle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: "switch.aspirapolvere" })
    });
    return { success: true };
  });

  await aspirapolvere.expose();
  console.log("Esposta: SmartPlug_Aspirapolvere");
};