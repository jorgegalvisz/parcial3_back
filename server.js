require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());

// Conexión a MongoDB jjjjjjjjjjjjjjjjjj
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Modelo
const Resultado = mongoose.model("Resultado", {
  jugador: String,
  resultado: String,
  patron: [String],
  fecha: { type: Date, default: Date.now }
});

// Configura puerto serial
const port = new SerialPort({ path: "COM6", baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

let patronActual = [];
let nivel = 1;
let turno = "jugador1";
let respuestas = { jugador1: [], jugador2: [] };
let jugador1Nombre = "";
let jugador2Nombre = "";

// Generar patrón aleatorio
function generarPatron(nivel) {
  const opciones = ["UP", "DOWN", "LEFT", "RIGHT"];
  const patron = [];
  for (let i = 0; i < nivel; i++) {
    patron.push(opciones[Math.floor(Math.random() * opciones.length)]);
  }
  return patron;
}

io.on("connection", (socket) => {
  console.log("Jugador conectado (navegador)");

  patronActual = generarPatron(nivel);
  socket.emit("patron", patronActual);

  socket.on("nombres", (data) => {
    jugador1Nombre = data.jugador1;
    jugador2Nombre = data.jugador2;
  });

  socket.on("jugada", (data) => {
    if (turno !== "jugador2") return;

    const { respuesta } = data;
    respuestas.jugador2.push(respuesta);
    console.log("Jugador 2:", respuesta);

    if (respuestas.jugador2.length === patronActual.length) {
      verificarResultados();
    }
  });
});

parser.on("data", (data) => {
  if (turno !== "jugador1") return;

  const tecla = data.trim();
  respuestas.jugador1.push(tecla);
  console.log("Jugador 1:", respuestas.jugador1);

  if (respuestas.jugador1.length === patronActual.length) {
    turno = "jugador2";
    io.emit("turno-jugador2");
  }
});

function verificarResultados() {
  const correctoA = JSON.stringify(respuestas.jugador1) === JSON.stringify(patronActual);
  const correctoB = JSON.stringify(respuestas.jugador2) === JSON.stringify(patronActual);

  if (correctoA && !correctoB) {
    io.emit("ganador", jugador1Nombre);
  } else if (!correctoA && correctoB) {
    io.emit("ganador", jugador2Nombre);
  } else if (correctoA && correctoB) {
    nivel++;
    io.emit("ambos-correcto", nivel);
  } else {
    io.emit("ninguno", nivel);
  }

  turno = "jugador1";
  respuestas = { jugador1: [], jugador2: [] };
  patronActual = generarPatron(nivel);
  io.emit("patron", patronActual);
}

// Ajuste clave: servir correctamente los archivos estáticos desde /public
app.use(express.static(path.join(__dirname, "../public")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
