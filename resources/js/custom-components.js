let client;
let mqttData;

AFRAME.registerComponent('label-meshes', {
  init: function () {
    const el = this.el;
    let i = 0;
    el.addEventListener('model-loaded', () => {
      const object3D = el.getObject3D('mesh');
      if (!object3D) return;
      object3D.traverse((node) => {
        if (node.isMesh) {
          i = i + 1;
          const textEl = document.createElement('a-entity');
          textEl.setAttribute('id', 'picloudLabel-' + (i).toString());
          textEl.setAttribute('troika-text', {
            value: node.name,
            color: 'white',
            fontSize: 0.04,
            align: 'center',
          });
          textEl.setAttribute('rotation', '270 0 180');
          textEl.object3D.position.copy(node.position);
          textEl.object3D.position.y += 0.01;
          el.appendChild(textEl);

          const mqttControllerEl = document.createElement('a-entity');
          mqttControllerEl.setAttribute('id', 'picloud-' + (i).toString());
          mqttControllerEl.setAttribute('mqtt-controller-pi', '');
          mqttControllerEl.setAttribute('mqtt-data', '');
          el.appendChild(mqttControllerEl);
        }
      });
    });
  }
});

AFRAME.registerComponent('mqtt-data', {
  schema: {
    temp_c: { type: 'string', default: '' },
    cpu_percent: { type: 'string', default: '' },
    ip_hostname: { type: 'string', default: '' },
    ping_ms: { type: 'string', default: '' },
    heartbeat: { type: 'string', default: '' }
  },
});

AFRAME.registerComponent('mqtt-controller-pi', {
  init: function () {
    this.startMqtt(client);
  },
  startMqtt: function (client) {
    let id = this.el.id;
    console.log(id);
    client.subscribe(`student/picloud/${id}/temp_c`);
    client.subscribe(`student/picloud/${id}/cpu_percent`);
    client.subscribe(`student/picloud/${id}/ip_hostname`);
    client.subscribe(`student/picloud/${id}/ping_ms`);
    client.subscribe(`student/picloud/${id}/heartbeat`);
  },
  stopMqtt: function (client) {
    client.end(true);
    console.log('connection closed');
  }
});

AFRAME.registerComponent('pi-cloud-data', {
  init: function () {
    const WS_PROTOCOL = location.protocol === 'https:' ? 'wss' : 'ws';
    const BROKER_URL = `${WS_PROTOCOL}://mqtt.cetools.org:8080`;
    client = mqtt.connect(BROKER_URL);

    client.on("connect", () => {
      console.log("[MQTT] Connected");
    });
    client.on("error", (error) => {
      console.log(error);
    });

    const state = {};

    client.on('message', (topic, message) => {
      const idRpi = topic.match(/\d+/)?.[0];

      if (idRpi) {
        if (!state[idRpi]) {
          state[idRpi] = {
            temp: null,
            ip_hostname: null,
            ping_ms: null,
            cpu_percent: null
          };
        }
        let modelEl = document.querySelector('#picloud-' + idRpi.toString());

        if (topic.includes('temp')) {
  state[idRpi].temp = message.toString();

  const colorScaleFunction = d3
    .scaleThreshold()
    .domain([34, 37, 40, 43, 46, 49, 52])
    .range([
      [0 / 255, 0 / 255, 255 / 255],
      [102 / 255, 204 / 255, 255 / 255],
      [255 / 255, 255 / 255, 102 / 255],
      [255 / 255, 204 / 255, 102 / 255],
      [255 / 255, 153 / 255, 51 / 255],
      [252 / 255, 98 / 255, 32 / 255],
      [255 / 255, 0 / 255, 0 / 255]
    ]);

  let foundObject = null;
  modelEl.parentNode.object3D.traverse((node) => {
    if (node.name.includes(idRpi)) {
      foundObject = node;
      foundObject.material = foundObject.material.clone();
      foundObject.material.color.fromArray(colorScaleFunction(parseInt(message)));
    }
  });
}
        if (topic.includes('ip_hostname')) { state[idRpi].ip_hostname = message.toString(); }
        if (topic.includes('ping_ms')) { state[idRpi].ping_ms = message.toString(); }
        if (topic.includes('cpu_percent')) { state[idRpi].cpu_percent = message.toString(); }
        if (topic.includes('heartbeat')) { state[idRpi].heartbeat = message.toString(); }

        modelEl.setAttribute('mqtt-data', {
          temp_c: state[idRpi].temp,
          cpu_percent: state[idRpi].cpu_percent,
          ip_hostname: state[idRpi].ip_hostname,
          ping_ms: state[idRpi].ping_ms,
          heartbeat: state[idRpi].heartbeat
        });
      }
    });
  }
});

AFRAME.registerComponent("click-handler", {
  init: function () {
    var el = this.el;
    var rayEl = document.querySelector("[raycaster]").components;
    var drawerOpen = false;

    el.addEventListener("click", function (evt) {
      let intersects = rayEl.raycaster.intersectionDetail.intersections;

      if (intersects.length > 0) {
        console.log(intersects);

        for (var interObj of intersects) {
          if (interObj.object.name.startsWith("pi")) {
            let name = interObj.object.name.slice(2);
            let piName = interObj.object.el.querySelector('#picloud-' + name);
            console.log(piName);
            mqttData = piName.getAttribute('mqtt-data');

            var Chkinput = document.getElementById("pure-toggle-left");
            Chkinput.click();
            drawerOpen = true;

            updateText(interObj);

            document.getElementById("ip_hostname").innerText = `PiName:${mqttData.ip_hostname}`;
            document.getElementById("cpu_percent").innerText = `CPU ${mqttData.cpu_percent}%`;
            document.getElementById("ping_ms").innerText = `Ping ${mqttData.ping_ms} ms`;
            document.getElementById("temp").innerText = `Temperature ${mqttData.temp_c}C`;
            document.getElementById("heartbeat").innerText = `Last seen online: ${mqttData.heartbeat}`;
            break;
          }
        }
      }
    });

    function updateText(interObj) {
      if (drawerOpen) {
        document.getElementById("ip_hostname").innerText = `PiName:${mqttData.ip_hostname}`;
        document.getElementById("cpu_percent").innerText = `CPU ${mqttData.cpu_percent}%`;
        document.getElementById("ping_ms").innerText = `Ping ${mqttData.ping_ms} ms`;
        document.getElementById("temp").innerText = `Temperature ${mqttData.temp_c}C`;
        document.getElementById("heartbeat").innerText = `Last seen online: ${mqttData.heartbeat}`;
        requestAnimationFrame(() => updateText(interObj));
      }
    }

    document.getElementById("pure-toggle-left").addEventListener("click", function () {
      drawerOpen = !drawerOpen;
    });
  },
});