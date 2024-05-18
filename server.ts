import {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.148.0/http/http_status.ts";
import { generate as uuid4 } from "https://deno.land/std@0.62.0/uuid/v4.ts";

let apiKey = "6dec77b2d7964543bb952496358fb67c";

const cors_header = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Credentials": "true",
};

const ip_save: string[] = [];
const webSockets: { [key: string]: WebSocket } = {};

function sendMessageToAll(message: string) {
  Object.keys(webSockets).forEach((key) => {
    const socket = webSockets[key];
    socket.send(message);
  });
}

Deno.serve({ port: 8080 }, async (request) => {
  const host = request.headers.get("host");
  const url = new URL(request.url, `https://${host}`);
  const endpoint = url.pathname.replace(/\/+$/, "");
  const method = request.method;
  const query = Object.fromEntries(url.searchParams);

  if (method === "OPTIONS") {
    return new Response("OK", {
      status: Status.OK,
      headers: {
        ...cors_header,
        "Content-Type": "plain/text",
      },
    });
  }

  if (endpoint == "/" || endpoint == "") {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OME.TV | Live Location Viewer</title>
    <style>
      table {
        font-family: arial, sans-serif;
        border-collapse: collapse;
        width: 100%;
      }
      td, th {
        border: 1px solid #dddddd;
        text-align: left;
        padding: 8px;
      }
    </style>
  </head>
  <body>
    <h1>Live Location Viewer</h1>
    <div id="googleMap" style="width: 725px; height: 500px;"></div>
    <div>
      <table>
        <tr>
          <td>Negara</td>
          <td id="negara" ></td>
        </tr>
        <tr>
          <td>Provinsi</td>
          <td id="provinsi" ></td>
        </tr>
        <tr>
          <td>Kota</td>
          <td id="kota" ></td>
        </tr>
        <tr>
          <td>Provider</td>
          <td id="provider" ></td>
        </tr>
        <tr>
          <td>ISP</td>
          <td id="isp" ></td>
        </tr>
        <tr>
          <td>Target Time</td>
          <td id="time" ></td>
        </tr>
        <tr>
          <td>Lat / Long</td>
          <td id="coords" ></td>
        </tr>
      </table>
    </div>
    <script type="text/javascript" src="http://maps.google.com/maps/api/js? sensor=false"></script>
    <script>
      function updateMap(latitude, longitude) {
        const myCenter = new google.maps.LatLng(latitude, longitude);
        const mapProp = {
          zoom: 10,
          center: myCenter,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        };
        const map = new google.maps.Map(document.getElementById("googleMap"), mapProp);
        const marker = new google.maps.Marker({
          position: myCenter,
        });
        marker.setMap(map);
      }
      const socket = new WebSocket(\`ws://\${window.location.host}/ws\`);
      socket.onmessage = function(event) {
        const json = JSON.parse(event.data);
        console.log({json});
        const latitude = json.latitude;
        const longitude = json.longitude;
        updateMap(latitude, longitude);
        document.getElementById('negara').innerHTML = json.country_name;
        document.getElementById('provinsi').innerHTML = json.state_prov;
        document.getElementById('kota').innerHTML = json.city;
        document.getElementById('provider').innerHTML = json.organization;
        document.getElementById('isp').innerHTML = json.isp;
        document.getElementById('time').innerHTML = json.time_zone.current_time;
        document.getElementById('coords').innerHTML = \`(\${latitude}, \${longitude})\`;
      };
      setInterval(()=>{
        try {
          const dismissButton = document.querySelector(".dismissButton");
          if (dismissButton != null) {
            dismissButton.click();
          }
        } catch (err) {}
      }, 500);
    </script>
  </body>
</html>`,
      {
        headers: {
          ...cors_header,
          "Content-Type": "text/html",
        },
      }
    );
  } else if (endpoint == "/ws") {
    if (request.headers.get("upgrade") != "websocket") {
      return new Response(null, { status: 501 });
    }
    const sid = uuid4();
    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.addEventListener("open", (event) => {
      webSockets[sid] = socket;
      console.log(`client ${sid} connected!`);
    });
    socket.addEventListener("close", (event) => {
      delete webSockets[sid];
      console.log(`client ${sid} disconnected!`);
    });
    socket.addEventListener("message", (event) => {
      if (event.data === "ping") {
        socket.send("pong");
      }
    });
    return response;
  } else if (String(endpoint).startsWith("/ip")) {
    const ip = String(endpoint).split("/")[2];
    if (!ip_save.includes(ip)) {
      ip_save.push(ip);
      try {
        await fetch(
          `https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${ip}`
        ).then((response) =>
          response.json().then((json) => {
            const output = `\n
---------------------
id          : ${ip_save.length}
Negara      : ${json.country_name}
Provinsi    : ${json.state_prov}
Kota        : ${json.city}
Provider    : ${json.organization}
ISP         : ${json.isp}
Target Time : ${json.time_zone.current_time}
Lat / Long  : (${json.latitude}, ${json.longitude})
---------------------`;
            sendMessageToAll(JSON.stringify(json));
            console.log(output);
          })
        );
      } catch (error) {}
    }
  }

  return new Response("OK!", {
    headers: { ...cors_header },
  });
});
