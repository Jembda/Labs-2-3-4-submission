import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();


const azureCredentials = {
    endpoint:"https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
    key: KEY,
};

const azureLanguageCredentials = {
    endpoint: "https://260026.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
    key: NLU_KEY,
    deploymentName: "Apointment",
    projectName: "Apointment",

};

const settings = {
    azureLanguageCredentials: azureLanguageCredentials,
    azureCredentials: azureCredentials,
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 5000,
    local: "en-US",
    ttsDefaultVoice: "en-US-DavisNeural",

}

/* Grammar defination */    
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
  nelson: { response: "Nelson Mandela was South Africa's President." },
  castro: { response: "Fidel Castro was Cuba's President."},
  gandhi: { response: "Indira Gandhi was India's PM."},
  kobe: { response: "Kobe Bryant was Basketball player."},
  chomsky: { response: "Noam Chomsky is father of generative grammar."},
  dag: { response: "Dag Hammarskjöld was UN secretary general."},
  trump: { response: "Donald Trump is former US president."},
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
              utterance: "Hello, welcome! Who would you like to meet?",
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
          on: {SPEAK_COMPLETE: "CheckWholDay" }, //"ListenWholeDay"
        },
        CheckWholDay: {
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
                isWholeDay: "yes",

              }),
              },
              {
                guard: ( { event }) => event.value[0].utterance.toLowerCase() === "no",
                target: "GetMeetingTime", 
                actions: assign({
                  isWholeDay: "no",
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
        //activation of NLU */,
          on: {
            RECOGNISED:{
              target: "ConfirmAppointment",
              actions: assign({
                meetingTime: ( { event }) => event.value[0].utterance.toLowerCase(),
              }),
            },
          },           
        },
        ConfirmWholeDayAppointment: {
          entry: ({ context }) => 
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: `Do you want to create an appointment with ${context.meetingWithName} on ${context.meetingDate} for the whole day?`,
            },
          }),
          on: { SPEAK_COMPLETE: "ListenConfirmation" }, 
        },

        ConfirmAppointment: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: `Do you want to create an appointment with ${context.meetingWithName} on ${context.meetingDate} at ${context.meetingTime}?`,
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
                  //meetingWithName: "", 
                  //meetingDate: "",
                  meetingTime: "",
                  isWholeDay: false,
                }),
              },
              //It should make ask you to reapet the same question.. 
            ],
          },
        },
        AppointmentCreated: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: "Your appointment has been created.",
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
  console.log("Meeting with: ", state.context.meetingWithName);
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