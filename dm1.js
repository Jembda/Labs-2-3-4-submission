import { assign, createMachine, createActor, interpret, setup } from "xstate";
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
    deploymentName: "anagrams",
    projectName: "AnagramGame",

};

const settings = {
    azureLanguageCredentials: azureLanguageCredentials,
    azureCredentials: azureCredentials,
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 10000,
    local: "en-US",
    ttsDefaultVoice: "en-US-DavisNeural",

};

const anagrams = [
  { word: "listen", anagram: "enlist" },
  { word: "silent", anagram: "listen" },
  { word: "debit card", anagram: "bad credit" },
  { word: "astronomer", anagram: "moon starer" },
  { word: "eleven plus two", anagram: "twelve plus one" },
  { word: "funeral", anagram: "real fun" },
  { word: "cinema", anagram: "iceman" },
  { word: "dormitory", anagram: "dirty room" },
  { word: "debit", anagram: "bited" },
  { word: "schoolmaster", anagram: "the classroom" },
  { word: "live", anagram: "evil"},
  { word: "race", anagram: "care"},
  { word: "post", anagram: "stop"},
  { word: "heart", anagram: "earth"},
  { word: "night", anagram: "thing"},
];


function userAnswer(utterance) {
    return utterance.toLowerCase() in anagrams;
  }

function generateAnagram() {
  const randomPair = anagrams[Math.floor(Math.random() * anagrams.length)];
  return randomPair;
}

function checkAnswer(answer, currentAnagram) {
  return answer.toLowerCase() === currentAnagram.anagram.toLowerCase();
  
}

const MAX_CHALLENGES = 5;

const anagramGameMachine = setup({
    actions: {}
}).createMachine({
    
    context: {
        count: 0,
        points: 0,
        userAnswer: "",
        utterance: "",
        currentAnagram: null,
        ssRef: null,
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
            on: { ASRTTS_READY: "CreateAnagramChallenge" },
        },
        CreateAnagramChallenge: {
            initial: "Start",
            states: {
                Start: {
                    entry: ({ context }) =>
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                                utterance: `Welcome to the Anagram Game! Before we start, let me give you a quick introduction. An anagram is a unique form of wordplay that involves the rearrangement of letters from a word or phrase to create a new word or phrase with a different meaning. For example the word 'ten' can form the anagram 'net'. This game has three levels: beginner, intermediate, and advanced. You’ll have twenty seconds for each challenge, with the opportunity to try again if needed. Let me know if you are ready. Shall we start with the ${MAX_CHALLENGES} challenges?`,
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
                              guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "yes",
                              target: "#DM.CreateAnagramChallenge.NoInput",  
                          },
                          {
                              guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "no",
                              target: "#DM.Done",    
                          },
                          
                      ],
                                      
                      
                  },               
                    
                },
                NoInput: {
                  entry: ({ context }) => {
                      
                      context.ssRef.send({
                          type: "SPEAK",
                          value: {
                              utterance: `I cannot hear you! Do want to start? Please say 'yes' or 'no'`,
                          },
                      });
                  },

                  on: { SPEAK_COMPLETE: "ListenConfirmToStart" },
                  after: {
                    10000: "#DM.CreateAnagramChallenge.ListenToStart",
                  }
                  
              },ListenConfirmToStart: {
                entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true },
                }),
                  on: {
                      RECOGNISED: [
                          {
                              guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "yes",
                              target: "#DM.CreateAnagramChallenge.PresentChallenge",  
                          },
                          {
                              guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "no",
                              target: "#DM.Done",    
                          },
                          
                      ],              
                    
                  },             
                
            },
              PresentChallenge: {
                entry: ({ context }) => {
                    const currentAnagram = generateAnagram();
                    context.currentAnagram = currentAnagram;
                    context.count++;
                    context.ssRef.send({
                        type: "SPEAK",
                        value: {
                            utterance: `Excellent! What is the anagram for ${currentAnagram.word}?`,
                        },
                    });
                },

                on: { SPEAK_COMPLETE: "ListenAnswer" },
                
            },
                ListenAnswer: {
                  entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true },
                  }), 
                  on: {
                    RECOGNISED: {
                      target: "TryAgain",
                      actions: [
                        assign({
                          
                          utterance: ({_, event}) => event.value[0].utterance,
                          }),                             
                          ({ event }) => console.log(event.value[0].confidence),
                          ({ event }) => console.log(event.value[0].intent),
                          ],
                        },
                      },
                    },
                TryAgain: {
                  entry: ({ context }) => {
                    if (!checkAnswer(context.utterance, context.currentAnagram)){
                      context.ssRef.send({
                        type: "SPEAK",
                        value: {
                          utterance: "Incorrect. Please try again."
                        }
                      });
                    } else {
                      return "GiveFeedback";
                    }
                  },
                  on: {
                    SPEAK_COMPLETE: "ListenTryAgain"
                  }
                }, 
                ListenTryAgain:{
                  entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true},
                }),
                on: {
                  RECOGNISED: {
                    target: "GiveFeedback",
                    actions: [
                      assign({
                        
                        utterance: ({_, event}) => event.value[0].utterance,
                        }),
                           
                        ({ event }) => console.log(event.value[0].confidence),
                        ({ event }) => console.log(event.value[0].intent),
                        ],
                      },
                    },               

                },

                GiveFeedback: {
                  entry: ({ context }) => {
                      if (checkAnswer(context.utterance, context.currentAnagram)) {
                          context.points++;
                      }
                      context.ssRef.send({
                          type: "SPEAK",
                          value: {
                              utterance: `You are ${checkAnswer(context.utterance, context.currentAnagram) ? 'right' : 'wrong'}! The anagram for ${context.currentAnagram.word} is ${context.currentAnagram.anagram}. Your score is ${context.points} out of ${context.count} challenges.`,
                          },
                      });
                  },
                  on: { SPEAK_COMPLETE: "AskConfirmation" },
              },


                AskConfirmation: {
                    entry: 
                        ({ context }) =>
                            context.ssRef.send({
                                type: "SPEAK",
                                value: {
                                    utterance: "Do you want to continue? Please respond with 'yes' or 'no'.",
                                },
                            }),
                        
                        on: { SPEAK_COMPLETE: "ListenConfirmation", },
                    
                },
                ListenConfirmation: {
                    entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true },
                  }),
                    on: {
                        RECOGNISED: [
                            {
                                guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "yes",
                                target: "#DM.CreateAnagramChallenge.PresentChallenge",  
                            },
                            {
                                guard: ({_, event}) => event.value[0].utterance.toLowerCase() === "no",
                                target: "#DM.NotContinuing",    
                            },
                            
                        ],                
                        
                    },                               
                   
                },      

            },
        },              
        
        NotContinuing: {
          entry: ({ context }) => {
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "Thank you for playing this game!"
              }

            })
                        

          },
            
        },

        Done: {
          entry: ({ context }) => {
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: "Thank you for your visit!"
              }

            })
                        

          },
        }
    }, 
  
});                           
                     
                
               
const utterance = (event) => {
    if (event && event.value && Array.isArray(event.value) && event.value.length > 0) {
      const utterance = event.value[0].utterance;
      console.log("EXpected answered:", utterance);
    } else {
      console.log('Event object is undefined or has unexpected structure');
    }
};


const dmActor = createActor(anagramGameMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
    console.log("Current state:", state.value);
    console.log("Current Anagram : ", state.context.currentAnagram)
    console.log("Anagram for: ", state.context.utterance)
    // console.log("Current Anagram : ", state.context.utterance)
}); 


export function setupButton(myButton) {
    Element.addEventListener("click", () => {
      dmActor.send({ type: "CLICK" });
    });

    dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
        Element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
    });
}

const dmMachine = createMachine({

})

dmMachine.subscribe((state) => {
      /* if you want to log some parts of the state */
      console.log("Current state:", state.value);
      console.log("Anagram for: ", state.context.word)
      console.log("Anagram for: ", state.context.currentAnagram)
      
      const { intent, confidence } = state.context;
      console.log("Intent:", intent, "\nConfidence:", confidence);
    });

dmActor.subscribe((state) => {
    console.log(state)
});