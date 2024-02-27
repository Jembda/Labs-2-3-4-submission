import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
    endpoint: "https://260026.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
    key: NLU_KEY /** reference to your Azure CLU key */,
    deploymentName: "Apointment" /** your Azure CLU deployment */,
    projectName: "Apointment" /** your Azure CLU project name */,
  };
  
  const settings = {
    azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
    azureCredentials: azureCredentials,
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 5000,
    locale: "en-US",
    ttsDefaultVoice: "en-US-DavisNeural",
  };
          
  
/* Grammar definition */
const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  david:{person: "David "},
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  yes: { response: "yes" },
  no: { response: "no" },
  nelson: { response: "Nelson Mandela was South Africa President." },
  castro: { response: "Fidel Castro was Cuba President."},
  gandhi: { response: "Indira Gandhi was India PM."},
  kobe: { response: "Kobe Bryant was Basketball player."},
  chomsky: { response: "Noam Chomsky is father of generative grammar."},
  dag: { response: "Dag Hammarskjöld UN secretary general."},
  trump: { response: "Donald Trump former US president."},
  putin: { response: "Vladimir Putin is current Russia president"},
  haile: { response: "Haile Gebreselassie is long distance runner."},
  christiano: { response: "Christiano Ronaldo is footballer."}, 

};


/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

const dmMachine = setup({
  actions: {
    /* define your actions here */
       
  },
}).createMachine({
  context: {
    count: 0,
    meetingWithName: "",
    meetingDate: "",
    meetingTime: "",
    isWholeDay: false,
    ssRef: null,
  },
//   id: "DM",
//   initial: "Prepare",
//   states: {
//     Prepare: {
//       entry: [
//         assign({
//           ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
//         }),
//         ({ context }) => context.ssRef.send({ type: "PREPARE" }),
//       ],
//       on: { ASRTTS_READY: "WaitToStart" },
//     },
//     WaitToStart: {
//       on: {
//         CLICK: "PromptAndAsk",
//       },
//     },
//     PromptAndAsk: {
//       initial: "Prompt",
//       states: {
//         Prompt: {
//           entry: ({ context }) =>
//             context.ssRef.send({
//               type: "SPEAK",
//               value: {
//                 utterance: `Hello world!`,
//               },
//             }),
//           on: { SPEAK_COMPLETE: "Ask" },
//         },
//         Ask: {
//           entry: ({ context }) =>
//             context.ssRef.send({
//               type: "LISTEN",
//             }),
//           on: {
//             RECOGNISED: {
//               actions: ({ context, event }) =>
//                 context.ssRef.send({
//                   type: "SPEAK",
//                   value: {
//                     utterance: `You just said: ${
//                       event.value[0].utterance
//                     }. And it ${
//                       isInGrammar(event.value[0].utterance) ? "is" : "is not"
//                     } in the grammar.`,
//                   },
//                 }),
//             },
//             SPEAK_COMPLETE: "#DM.Done",
//           },
//         },
//       },
//     },
//     Done: {
//       on: {
//         CLICK: "PromptAndAsk",
//       },
//     },
//   },
// });

id: "DM",
  initial: "Prepare",
  states:{
    Prepare: {
      entry:[
        assign({
          ssRef:({ spawn }) => spawn(speechstate, { input: settings }),
        }),
        ({ context }) => context.ssRef.send({ type: "PREPARE" }),
      ],
      on: { ASRTTS_READY: "CreateAppointment" },
    },
    CreateAppointment: {
      initial: "Start",
      states: {
        Start: {
          entry: ({ context }) =>
           context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "Welcome to our Service center. Do you have an appointment? Who are you meeting with?",
            },
           }),
           on: {SPEAK_COMPLETE: "GetName" },
        },
        GetName: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
          }),

          on: {
            RECOGNISED: {
              target: "GetMeetingDay",
              actions: assign({
                meetingWithName:({ event }) => event.value[0].utterance.toLowerCase(),
              }),               
              
            },
          },          
        },
        GetMeetingDay: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "On which day is your meeting?",
            },
          }),
          on: { SPEAK_COMPLETE: "ListenMeetingDay" },
        },

        ListenMeetingDay: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
           }),
           on: {
            RECOGNISED: {
              target: "IsWholeDay",
              actions: assign({
                meetingDate: ({ event }) => event.value[0].utterance.toLowerCase(),
              })
            },
           },
           
        },
        IsWholeDay: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "Will it take the whole day?",
            },
          }),
          on: {SPEAK_COMPLETE: "ListenWholeDay" },
        },
        ListenWholeDay: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN"
          }),
          on:{
            RECOGNISED: [
              {
                guard: ( { event }) => event.value[0].utterance.toLowerCase() === "yes",
              target: "ConfirmWholeDayAppointment",
              actions: assign({
                isWholeDay: true,

              }),
              },
              {
                guard: ( { event }) => event.value[0].utterance.toLowerCase() === "no",
                target: "GetMeetingTime", 
                actions: assign({
                  isWholeDay: false,
                }),
              },              
            ],
          },
        },

        GetMeetingTime: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "What time is your meeting?",
            },
          }),
          on: { SPEAK_COMPLETE: "ListenMeetingTime" },
        },

        ListenMeetingTime: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true } /** Local activation of NLU */,
          }),      
          
        //   ({ context }) =>
        //   context.ssRef.send({
        //     type: "LISTEN",
        //   }),
          on: {
            RECOGNISED:{
              target: "ConfirmAppointment",
              actions: assign({
                MeetingTime: ( { event }) => event.value[0].utterance.toLowerCase(),
              }),
            },
          },           
        },
        ConfirmWholeDayAppointment: {
          entry: ({ context }) => 
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: 'Do you want to create an appointment with ${meetingWithName} on ${meetingDate} for the whole day?',
            },
          }),
          on: { SPEAK_COMPLETE: "ListenConfirmation" }, 
        },

        ConfirmAppointment: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: 'Do you want to create an appointment with ${meetingWithName} on ${meetingDate} at ${context.meetingTime}?',
            },
          }),
          on: { SPEAK_COMPLETE: "ListenConfirmation" },
        },
        ListenConfirmation: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
          }),
          on: {
            RECOGNISED: [
              {
                guard: ( { event }) => event.value[0].utterance.toLowerCase() === "yes",
                target: "AppointmentCreated",
              },
              {
                guard: ( { event }) => event.value[0].utterance.toLowerCase() === "no",
                target: "AppointmentNotCreated",
                actions: assign({
                  meetingWithName: "",
                  meetingDate: "",
                  meetingTime: "",
                  isWholeDay: false,
                }),
              },
            ],
          },
        },
        AppointmentCreated: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "Your appointment has been created."
            },
          }),
          type: "final",
        },
        AppointmentNotCreated:{
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "Your appointment has not been created.",
            },
          }),
          type: "final",
        },
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  /* if you want to log some parts of the state */
  console.log("Current state:", state.value);
  console.log("Meeting with: ", state.context.meetingWithName)
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}

dmActor.subscribe((state) => {
  console.log(state)
});