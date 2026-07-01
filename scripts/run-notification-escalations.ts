import { runNotificationEscalations } from "../lib/notification-escalations";

runNotificationEscalations()
  .then((result) => {
    console.log(JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
