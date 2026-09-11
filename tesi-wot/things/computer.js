module.exports = async function registerComputer(WoT, HASS_URL, HASS_TOKEN) {
  const computer = await WoT.produce({
    title: "SmartPlug_Computer",
    description: "Presa computer",
    "@context": "https://www.w3.org/2019/wot/td/v1",
    properties: {
      status: { type: "string", readOnly: true },
      power: { type: "number", unit: "W", readOnly: true }
    },
    actions: { toggle: {} }
  });

  computer.setPropertyReadHandler("status", async () => {
    const res = await fetch(`${HASS_URL}/api/states/switch.computer`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return (await res.json()).state;
  });

  computer.setPropertyReadHandler("power", async () => {
    const resV = await fetch(`${HASS_URL}/api/states/sensor.computer_tensione`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    const resA = await fetch(`${HASS_URL}/api/states/sensor.computer_corrente`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    const voltage = parseFloat((await resV.json()).state) || 0;
    const current = parseFloat((await resA.json()).state) || 0;
    return parseFloat((voltage * current).toFixed(2));
  });

  computer.setActionHandler("toggle", async () => {
    await fetch(`${HASS_URL}/api/services/switch/toggle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: "switch.computer" })
    });
    return { success: true };
  });

  await computer.expose();
  console.log("Esposta: SmartPlug_Computer");
};