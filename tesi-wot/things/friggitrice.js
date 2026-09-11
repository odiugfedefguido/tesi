module.exports = async function registerFriggitrice(WoT, HASS_URL, HASS_TOKEN) {
  const friggitrice = await WoT.produce({
    title: "SmartPlug_Friggitrice",
    description: "Presa friggitrice ad aria",
    "@context": "https://www.w3.org/2019/wot/td/v1",
    properties: {
      status: { type: "string", readOnly: true },
      power: { type: "number", unit: "W", readOnly: true }
    },
    actions: { toggle: {} }
  });

  friggitrice.setPropertyReadHandler("status", async () => {
    const res = await fetch(`${HASS_URL}/api/states/switch.friggitrice_ad_aria`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return (await res.json()).state;
  });

  friggitrice.setPropertyReadHandler("power", async () => {
    const res = await fetch(`${HASS_URL}/api/states/sensor.friggitrice_ad_aria_consumo_di_corrente`, { headers: { Authorization: `Bearer ${HASS_TOKEN}` } });
    return parseFloat((await res.json()).state) || 0;
  });

  friggitrice.setActionHandler("toggle", async () => {
    await fetch(`${HASS_URL}/api/services/switch/toggle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HASS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: "switch.friggitrice_ad_aria" })
    });
    return { success: true };
  });

  await friggitrice.expose();
  console.log("Esposta: SmartPlug_Friggitrice");
};