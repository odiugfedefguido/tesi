module.exports = async function registerLavatrice(WoT, HASS_URL, HASS_TOKEN) {
  const lavatrice = await WoT.produce({
    title: "SmartPlug_Lavatrice",
    description: "Presa lavatrice",
    "@context": "https://www.w3.org/2019/wot/td/v1",
    properties: {
      status: { type: "string", readOnly: true },
      power: { type: "number", unit: "W", readOnly: true }
    },
    actions: { toggle: {} }
  });

  lavatrice.setPropertyReadHandler("status", async () => {
    const res = await fetch(`${HASS_URL}/api/states/switch.lavatrice`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return (await res.json()).state;
  });

  lavatrice.setPropertyReadHandler("power", async () => {
    const res = await fetch(`${HASS_URL}/api/states/sensor.lavatrice_consumo_di_corrente`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return parseFloat((await res.json()).state) || 0;
  });

  lavatrice.setActionHandler("toggle", async () => {
    await fetch(`${HASS_URL}/api/services/switch/toggle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: "switch.lavatrice" })
    });
    return { success: true };
  });

  await lavatrice.expose();
  console.log("Esposta: SmartPlug_Lavatrice");
};