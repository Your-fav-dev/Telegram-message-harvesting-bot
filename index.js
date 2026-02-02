import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from 'input';
import fs from "fs/promises";
import path from "path";

const appId = 123465;
const apiHash = "put hash here";
const stringSession = new StringSession("");

const channel = ["ConfigsHUB"] // double check this
const outputFile = path.join(__dirname, "config_harvested.json");

const client = new TelegramClient(stringSession, appId, apiHash, {
    connectionRetries : 5,
});

let buffer = [];

async function saveMessages(){
    if(buffer.length === 0) return;

    let existing = [];
    try {
        await fs.access(outputFile);

        const content = await fs.readFile(outputFile, "utf8");
        if(content.trim() === ""){
            console.log(`${outputFile} is empty -> making a new one right now`);
        }else {
            existing = JSON.parse(content);

            if(!Array.isArray(existing)){
                console.log("the existing info was not an array so its gone now");
                existing = [];
            }
        }
    } catch (err) {
        console.log(`Error : ${err}`);
    }
    existing.push(...buffer);

    await fs.writeFile(outputFile, JSON.stringify(existing, null, 2), "utf-8");
    buffer = []; // empty the buffer
};
// new way to write functions but ok XD
(async () => {
    console.log("Starting client...")

    await client.start({
        phoneNumber: async () => input.text("Phone Number: ") ,
        password: async () => input.text("Password (if 2FA): ") ,
        phoneCode: async () => input.text("Code : "),
        onError: (err) => console.log(`Login error : ${err}`),
    });

    console.log("Logged In");
    console.log("Session Starting (save this): ", client.session.save());
    
    // Optional: print watched channels (resolve them once)
  for (const username of channel) {
    try {
      const entity = await client.getEntity(username);
      console.log(`Watching: @${username} (ID: ${entity.id})`);
    } catch (err) {
      console.log(`Cannot access @${username}:`, err.message);
    }
  };

  client.addEventHandler(async (event) => {
    const msg = event.message;
    if(!msg.text || msg.media) return;
    // Check if it's from one of our watched channels
    if(!msg.peerId || !msg.peerId.channelId) return;

    let chat;
    try {
        chat = await client.getEntity(msg.peerId);
    } catch (err) {
        console.log(`Error : ${err}`)
        return;
    }

    const username = chat.username;
    if(!username || !channel.includes(username)) return;

    const data = {
      id: msg.id,
      date: new Date(msg.date * 1000).toISOString(),
      channel: username,
      text: msg.message,
      from_id: msg.fromId?.userId?.toString() ?? 'channel',
    };

    buffer.push(data);

    if(buffer.length >= 10){
        await saveMessages();
    }
  }, new (require("telegram/events")).NewMessage({})); // this defines what the hell is the event that this function is handeling which was called at the very begining

  setInterval(async () => {
    await saveMessages();
  }, 15000);

  console.log("Watching for new messages");

  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await saveMessages();
    await client.destroy();
    process.exit(0);
  });
})(); // the " () " runs this no name function