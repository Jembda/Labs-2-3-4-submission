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

const settings = {
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural", 
  
};

const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  david:{person: "David "},
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  
  viola : { word: "viola" },

};

// /* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
  
}
function getWord(utterance){
  return (grammar[utterance.toLowerCase()] || {}).word
}

const dmMachine = setup({
  actions: {
    say:({ context }, params ) => {
      const utterance = `${params}`;
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: utterance,
        },
      });
    },
  },
}).createMachine({  
  context: {
    word: "viola",
    confidence: 0,
  },
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: [
        assign({
          ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
        }),
        ({ context }) => context.ssRef.send({ type: "PREPARE" }),
      ],
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: {
        CLICK: "Main",
      },
    },
    Main: {
      initial: "Prompt",
      states: {
        Prompt: {
        entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "We are attemting to check this ASR model."),
        on: { SPEAK_COMPLETE: "AskWord" },                 
        },
        AskWord:{
        entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Can you say a word?"),
        on: { SPEAK_COMPLETE: "GetWord" },
        },
        GetWord:{
          entry: ({ context }) => context.ssRef.send({ type: "LISTEN"}),
          on: {
            RECOGNISED: {
              actions: [ ({ context, event }) => {
                      const recognizedWord = event.value[0].utterance.toLowerCase();
                      const isRecognized = isInGrammar(recognizedWord);
                      const confidence = event.value[0].confidence;
                      const recognizedGrammarWord = getWord(recognizedWord);
                      context.ssRef.send({
                        type: "SPEAK",
                        value:{
                          utterance: "You just said " + recognizedWord + ". And the word in grammar is " + context.word + ", is recognized: " + (isRecognized ? "yes" : "no") + ". Confidence: " + confidence,
                        },
                      });
                assign({ 
                  word: recognizedGrammarWord,
                  confidence: confidence,
                   });
                  }]
            },
            //SPEAK_COMPLETE: "#DM.Done",
            SPEAK_COMPLETE: "RecognitionComplete",
          },
        },
        RecognitionComplete: {
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "The goal to check the model is completed."),
          on: { SPEAK_COMPLETE: "#DM.Done" }
        },
      },
    },
    Done: {
      on: {
        CLICK: "Main",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  /* if you want to log some parts of the state */
console.log(state);
if (state.event && state.event.value) {
  console.log(state.event.value[0].confidence);
} else {
  console.log("No event value available");
}
  // console.log(state.event.value[0].confidence);
  // console.log(state);
  //console.log(`Recogined word: ${recogniezed}, Confidence: ${confidence}`);  
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}

function sendSpeechCommand(ssRef, type, utterance) {
  ssRef.send( {type, value: { utterance } });
}

