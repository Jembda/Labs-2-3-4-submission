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

};


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

const entities = [

  "Nelson Mandela",
  "Fidel Castro",
  "Indira Gandhi",
  "Kobe Bryant",
  "Noam Chomsky ",
  "Dag Hammarskjöld",
  "Vladimir Putin",
  "Donald Trump",
  "Vladimir Putin",
  "Christiano Ronaldo",
 
]

/* Helper functions */
 
  
  function getPerson(utterance) {
    return (grammar[utterance.toLowerCase()] || {}).person;
  }

// const ASR_THRESHOLD = 0.7;
// const NLU_THRESHOLD = 0.8; 

const dmMachine = setup({
    actions: {
        
    },
    
}).createMachine({
    initial: "Prepare",
    countex: {
        count: 0,
        meetingWithName: "",
        meetingDate: "",
        meetingTime: "",
        HandleNoInput: "",
        HandleOutOfGrammar: "",
        isWholeDay: false,
        ssRef: null,
    },
    id: "DM",
    initial: "Prepare",
    states: {
        Prepare: {
            entry: [
                assign({
                    ssRef: ({ spawn }) => spawn(speechstate, { input: settings}),
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
          on: { SPEAK_COMPLETE: "ListenToStart" },
        },
        ListenToStart: {
          entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true },
        }),
          on: {
              RECOGNISED: [
                  {
                      // guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "vip",
                      guard: ({_, event}) => event.value[0].utterance.toLowerCase() === 0,
                      target: "#DM.CreateAppointment.NoInput",  
                  },
                  
                  
              ],
              NOINPUT: {
                target: "#DM.CreateAppointment.NoInput",
              }                              
              
          },               
            
        },
        NoInput: {
          entry: ({ context }) => {
              
              context.ssRef.send({
                  type: "SPEAK",
                  value: {
                      utterance: `I don't get it! Please say a name.`,
                  },
              });
          },

          on: { SPEAK_COMPLETE: "GetName" },
          after: {
            10000: "#DM.CreateAppointment.ListenToStart",
          }
          
      },     
        GetName: {
          entry: ({ context}) => {
              // const topIntent = event.nluValue?.topIntent;
              // const firstEntity = event.nluValue?.entities?.[0];
              // const secondEntity = event.nluValue?.entities?.[1];             
              
              context.ssRef.send({ type: "LISTEN" });
          },
          on: {
              RECOGNISED: {
                  target: "GetMeetingDay",
                  
                  actions: [
                      assign({
                          
                          meetingWithName: ({ _, event }) => event.value[0].utterance,
                          // meetingWithName: ({_, event}) => event.value && event.value[0] ? event.value[0].utterance : "",
                                                    
                      }),                      
                      ({ event }) => event.nluValue?.intent.entities?.[0],
                      ({ event }) => event.nluValue?.intent.entities?.[1],
                          // Add more assignments as needed
                        // ({ event }) => console.log(event.nluValue[0].confidence),
                        // ({ event }) => console.log(event.nluValue[0].intent),
                  ],
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
              }),
            },
          },
        },
        RepeatPrompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "I'm sorry, could you please repeat that?",
              },
            }),
          on: { SPEAK_COMPLETE: "ListenMeetingDay" },
        },
        HandleNoInput: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "I'm sorry, I didn't hear you. Will the meeting take whole day, please say 'yes' or 'no' ?",
              },
            }),
          on: { SPEAK_COMPLETE: "GetName" },
        },
        HandleOutOfGrammar: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "Sorry, this is not in the Grammar."
              },
            }),
          on: { SPEAK_COMPLETE: "GetName" },
        },
        IsWholeDay: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "Will it take the whole day?",
              },
            }),
          on: { SPEAK_COMPLETE: "CheckWholeDay" },
        },
        CheckWholeDay: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => event.value[0].utterance.toLowerCase() === "yes",
                target: "ConfirmWholeDayAppointment",
                actions: assign({
                  isWholeDay: "yes",
                }),
              },
              {
                guard: ({ event }) => event.value[0].utterance.toLowerCase() === "no",
                target: "GetMeetingTime",
                actions: assign({
                  isWholeDay: "no",
                }),
              },
            ],
            NOINPUT: {
              entry: "HandleNoInput",
              always: "waitForUserInput"
            }
            
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
            }),
          on: {
            RECOGNISED: {
              target: "ConfirmAppointment",
              actions: assign({
                meetingTime: ({ event }) => event.value[0].utterance.toLowerCase(),
              }),
            },
            NOINPUT: "HandleNoInput",
            NOMATCH: "HandleOutOfGrammar",
            REPEAT: "RepeatPrompt",
          },
        },
        RepeatPrompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "I'm sorry, could you please repeat that? If you need assistance, just say 'help'.",
              },
            }),
          on: { SPEAK_COMPLETE: "ListenMeetingTime", },
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
                guard: ({ event }) => event.value[0].utterance.toLowerCase() === "yes",
                target: "AppointmentCreated",
              },
              {
                guard: ({ event }) => event.value[0].utterance.toLowerCase() === "no",
                target: "AppointmentNotCreated",
                actions: assign({
                  meetingTime: "",
                  isWholeDay: false,
                }),
              },
            ],
            target: "HandleNoInput",
            target: "HandleOutOfGrammar",
            target: "RepeatPrompt",
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
        AppointmentNotCreated: {
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
  const { intent, topIntent, firstEntity, secondEntity, thirdEntity, confidence } = state.context;
  console.log("Intent:", intent, "\nTop Intent:", topIntent, "\nFirst Entity:", firstEntity, "\nSecond Entity:", secondEntity, "\nThird Entity:", thirdEntity, "\nConfidence:", confidence);

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