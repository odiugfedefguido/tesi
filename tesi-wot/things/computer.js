module.exports = async function registerComputer(WoT, HASS_URL, HASS_TOKEN) {
  const computer = await WoT.produce({
    title: "smartplug_computer",
    description: "Presa computer",
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
      priority: 1,         // Priorità massima
      deferrable: false    // Il computer non è un carico differibile
    }
  });

  computer.setPropertyReadHandler("status", async () => {
    try {
      const res = await fetch(`${HASS_URL}/api/states/switch.computer`, { 
        headers: { Authorization: `Bearer ${HASS_TOKEN}` } 
      });
      if (!res.ok) return "off";
      const data = await res.json();
      return data.state || "off";
    } catch (e) {
      return "off";
    }
  });

  computer.setPropertyReadHandler("power", async () => {
    try {
      // Le Tapo P110 in Home Assistant espongono la potenza istantanea in Watt con un sensore dedicato
      const resP = await fetch(`${HASS_URL}/api/states/sensor.computer_current_consumption`, { 
        headers: { Authorization: `Bearer ${HASS_TOKEN}` } 
      });
      if (!resP.ok) return 0;
      const data = await resP.json();
      const powerVal = parseFloat(data.state);
      return isNaN(powerVal) ? 0 : powerVal;
    } catch (e) {
      return 0;
    }
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