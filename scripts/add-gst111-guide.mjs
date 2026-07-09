import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const guide = JSON.parse(readFileSync(resolve(root, "bio-study-guide.json"), "utf-8"));

const gstTopics = [
  {
    courseCode: "GST 111",
    topic: "Study Skills & Methods",
    summary: "Study skills are the techniques and strategies that help students acquire, retain, and recall information effectively. This block covers the SQ3R and KWL methods, effective reading techniques, note-taking versus note-making, and time management using SMART goals.",
    subtopics: [
      {
        title: "Effective Reading Techniques",
        keyPoints: [
          "Skimming: Glancing through material to get a general overview without close attention to details.",
          "Scanning: Selectively reading to locate specific information such as keywords or technical terms.",
          "Intensive Reading: Thorough and time-consuming reading used for examinations to comprehend and reproduce details.",
          "Extensive Reading: Reading for pleasure to gain general knowledge."
        ],
        mustKnow: [
          "Skimming is for general overview; scanning is for specific information.",
          "Intensive reading is required for exam preparation.",
          "Different reading purposes require different techniques."
        ],
        examTraps: [
          "Do not confuse skimming with scanning — skimming is for overview, scanning targets specific details.",
          "Intensive reading is not the same as extensive reading."
        ],
        possibleQuestionPoints: [
          "Distinguish between skimming and scanning with examples.",
          "When would you use intensive reading over extensive reading?"
        ],
        definitions: [
          "Skimming: Glancing through material for a general overview",
          "Scanning: Reading selectively to locate specific information",
          "Intensive reading: Thorough reading for deep comprehension",
          "Extensive reading: Reading for pleasure and general knowledge"
        ],
        processes: []
      },
      {
        title: "Study Methods",
        keyPoints: [
          "SQ3R Method: Survey (previewing), Question (asking preliminary questions), Read (thorough reading), Recall (mental rehearsal), Review (cross-checking goals).",
          "KWL Method: Know (what you already know), Want (what you want to know), Learn (what you have learned).",
          "SMART Goals: Specific, Measurable, Attainable, Realistic, Time-bound."
        ],
        mustKnow: [
          "SQ3R is a five-step technique for retaining information from texts.",
          "KWL is an active reading comprehension strategy.",
          "All study goals should be SMART."
        ],
        examTraps: [
          "SQ3R has five steps, not three. Remember: Survey, Question, Read, Recall, Review.",
          "KWL has three components, all equally important."
        ],
        possibleQuestionPoints: [
          "Explain each step of the SQ3R method.",
          "What does the KWL mnemonic stand for?",
          "Why should goals be SMART?"
        ],
        definitions: [
          "SQ3R: Survey, Question, Read, Recall, Review",
          "KWL: Know, Want, Learn",
          "SMART: Specific, Measurable, Attainable, Realistic, Time-bound"
        ],
        processes: []
      },
      {
        title: "Note-Taking vs Note-Making",
        keyPoints: [
          "Note-taking happens during lectures at the lecturer's pace.",
          "Note-making is a personal activity involving revisiting and revising notes to fill gaps and correct errors.",
          "Effective notes use abbreviations, headings, and bullet points."
        ],
        mustKnow: [
          "Note-taking is passive recording; note-making is active engagement.",
          "Note-making improves retention and understanding."
        ],
        examTraps: [
          "Note-taking and note-making are not interchangeable terms.",
          "Note-making happens after the lecture, not during."
        ],
        possibleQuestionPoints: [
          "Differentiate between note-taking and note-making.",
          "Why is note-making considered more effective for learning?"
        ],
        definitions: [
          "Note-taking: Recording information during a lecture at the speaker's pace",
          "Note-making: Personal activity of revising and organising notes after a lecture"
        ],
        processes: []
      }
    ]
  },
  {
    courseCode: "GST 111",
    topic: "Library Resources & Organisation",
    summary: "Libraries are organised information systems that collect, process, store, and disseminate recorded information. This block covers library types, classification schemes (LC, DDC, Moys), reference materials, OPAC, and the organisation of library resources.",
    subtopics: [
      {
        title: "Types of Libraries",
        keyPoints: [
          "Academic Library: Serves tertiary institutions (e.g., Kenneth Dike Library, University of Ibadan).",
          "Special Library: Caters to specific classes of people (e.g., IITA library).",
          "Public Library: General access for all, often called 'the people's university'.",
          "National Library: The apex library and major archive of a nation."
        ],
        mustKnow: [
          "Kenneth Dike Library is an academic library.",
          "Public libraries are called the 'people's university'.",
          "National libraries receive copies of all copyright publications."
        ],
        examTraps: [
          "Do not confuse academic libraries with public libraries.",
          "National libraries are not the same as public libraries."
        ],
        possibleQuestionPoints: [
          "What type of library is the Kenneth Dike Library?",
          "Why are public libraries called the 'people's university'?"
        ],
        definitions: [
          "Academic library: Library serving tertiary educational institutions",
          "Special library: Library serving a specific group or organisation",
          "Public library: Library accessible to all members of the community",
          "National library: The official archive and apex library of a nation"
        ],
        processes: []
      },
      {
        title: "Classification Schemes",
        keyPoints: [
          "Library of Congress (LC): Uses alphanumeric notation (letters + numbers).",
          "Dewey Decimal Classification (DDC): Uses purely numeric notation.",
          "Moys Classification Scheme: Designed specifically for legal information resources.",
          "Universal Decimal Classification (UDC): An international classification system."
        ],
        mustKnow: [
          "LC uses letters (A-Z) for main classes.",
          "DDC uses numbers (000-999).",
          "Moys is for law libraries only.",
          "LC class Q = Science, K = Law, L = Education, H = Social Sciences."
        ],
        examTraps: [
          "DDC is numeric, LC is alphanumeric — do not mix them up.",
          "Moys is NOT a general scheme; it is specifically for law."
        ],
        possibleQuestionPoints: [
          "What notation does the LC scheme use?",
          "Which scheme is used at Kenneth Dike Library?",
          "Identify the LC class for Science/Law/Education."
        ],
        definitions: [
          "LC: Library of Congress classification scheme (alphanumeric)",
          "DDC: Dewey Decimal Classification (numeric)",
          "Moys: Classification scheme for legal resources",
          "Call mark: Combination of class number and author identifier"
        ],
        processes: []
      },
      {
        title: "Reference Materials & OPAC",
        keyPoints: [
          "Reference materials are for consultation of specific items, not consecutive reading.",
          "Examples: Encyclopaedias, Dictionaries, Atlases, Gazetteers, Biographical Dictionaries.",
          "OPAC (Online Public Access Catalogue) allows users to search for library holdings electronically.",
          "Library sections include Circulation, Serials, Cataloguing, and Institutional Repository."
        ],
        mustKnow: [
          "Reference books are generally not for loan.",
          "OPAC is a computerised catalogue system.",
          "The Verso of a title page contains copyright information."
        ],
        examTraps: [
          "Reference materials are not meant to be read cover to cover.",
          "A gazetteer is a geographical dictionary, not a general dictionary."
        ],
        possibleQuestionPoints: [
          "What is the function of OPAC?",
          "Name three types of reference materials.",
          "Where do you find copyright information in a book?"
        ],
        definitions: [
          "OPAC: Online Public Access Catalogue",
          "Gazetteer: A geographical dictionary",
          "Verso: The back of the title page containing copyright details",
          "Call Mark: The label on a book indicating its shelf location"
        ],
        processes: []
      }
    ]
  },
  {
    courseCode: "GST 111",
    topic: "Morphology & Word Formation",
    summary: "Morphology is the branch of linguistics that studies the internal structure of words and how they are formed. This block covers morphemes (free vs bound, derivational vs inflectional), and word formation processes including affixation, blending, compounding, back-formation, borrowing, and conversion.",
    subtopics: [
      {
        title: "Morphemes",
        keyPoints: [
          "A morpheme is the smallest meaningful unit of grammar.",
          "Free morphemes can stand alone as words (e.g., play, test, cat).",
          "Bound morphemes must attach to another morpheme (e.g., -ful, -ed, un-).",
          "Inflectional morphemes perform grammatical functions without changing word class (e.g., -s for plural, -ed for past tense).",
          "Derivational morphemes create new words or change word class (e.g., teach → teacher)."
        ],
        mustKnow: [
          "'Unhappiness' has 3 morphemes: un- + happy + -ness.",
          "Bound morphemes are also called affixes.",
          "Inflectional morphemes do NOT change word class."
        ],
        examTraps: [
          "Do not confuse morphemes with syllables.",
          "Derivational morphemes change meaning or word class; inflectional ones only add grammatical information."
        ],
        possibleQuestionPoints: [
          "How many morphemes are in 'presidential'? (Answer: 3)",
          "Distinguish between derivational and inflectional morphemes."
        ],
        definitions: [
          "Morpheme: The smallest meaningful unit of grammar",
          "Free morpheme: A morpheme that can stand alone as a word",
          "Bound morpheme: A morpheme that must attach to another morpheme",
          "Inflectional morpheme: A bound morpheme that marks grammatical function",
          "Derivational morpheme: A bound morpheme that creates new words"
        ],
        processes: []
      },
      {
        title: "Word Formation Processes",
        keyPoints: [
          "Affixation: Adding a prefix or suffix to a root (e.g., re + write = rewrite).",
          "Blending: Combining parts of two words (e.g., breakfast + lunch = brunch).",
          "Compounding: Joining two complete words (e.g., girlfriend, notebook).",
          "Back-formation: Creating a shorter word by removing an affix (e.g., edit from editor).",
          "Borrowing: Taking words from other languages (e.g., 'alcohol' from Arabic).",
          "Conversion: Using a word in a different word class without changing form (e.g., 'to man' from 'man')."
        ],
        mustKnow: [
          "Blending creates words like 'brunch' and 'motel'.",
          "Borrowing accounts for many English words from Latin, Greek, French, and Arabic.",
          "Conversion allows the same word to function as both noun and verb."
        ],
        examTraps: [
          "Blending is NOT the same as compounding.",
          "Back-formation removes a supposed affix; affixation adds one."
        ],
        possibleQuestionPoints: [
          "Identify the word formation process: 'brunch' (blending), 'email' (conversion), 'alcohol' (borrowing).",
          "Explain back-formation with an example."
        ],
        definitions: [
          "Affixation: Adding affixes to a root word",
          "Blending: Combining parts of two words to form a new word",
          "Compounding: Joining two complete words",
          "Back-formation: Creating a new word by removing an affix",
          "Borrowing: Adopting words from another language",
          "Conversion: Changing a word's grammatical function without changing form"
        ],
        processes: []
      }
    ]
  },
  {
    courseCode: "GST 111",
    topic: "English Grammar & Usage",
    summary: "Grammar is the set of structural rules governing the composition of clauses, phrases, and words. This block covers word classes (open and closed), phrase types, clause types, sentence structures, voice transformation (active/passive), direct and indirect speech, and concord rules.",
    subtopics: [
      {
        title: "Word Classes",
        keyPoints: [
          "Open classes (frequently accept new words): Nouns, Verbs, Adjectives, Adverbs.",
          "Closed classes (fixed, rarely change): Pronouns, Prepositions, Conjunctions, Determiners.",
          "Nouns name people, places, things, or ideas (common, proper, collective, abstract, concrete).",
          "Verbs express actions or states (transitive/intransitive, dynamic/stative, auxiliary).",
          "Adjectives qualify nouns; Adverbs modify verbs, adjectives, or other adverbs."
        ],
        mustKnow: [
          "Open classes regularly accept new members; closed classes do not.",
          "Transitive verbs take objects; intransitive verbs do not.",
          "Auxiliary verbs help main verbs express tense or mood."
        ],
        examTraps: [
          "A word can belong to multiple classes depending on context.",
          "Interjections are a separate class, not part of open or closed categories."
        ],
        possibleQuestionPoints: [
          "Distinguish between open and closed word classes.",
          "Give examples of transitive and intransitive verbs.",
          "Identify the word class of a given word in context."
        ],
        definitions: [
          "Open class: Word class that accepts new members (nouns, verbs, adjectives, adverbs)",
          "Closed class: Word class with fixed membership (pronouns, prepositions, conjunctions, determiners)",
          "Transitive verb: A verb that takes an object",
          "Intransitive verb: A verb that does not take an object"
        ],
        processes: []
      },
      {
        title: "Phrases and Clauses",
        keyPoints: [
          "A phrase is a group of words functioning as a unit without both a subject and a finite verb.",
          "Noun phrase: Headed by a noun (e.g., 'the handsome man').",
          "Verb phrase: Headed by a lexical verb.",
          "Gerundive phrase: Headed by a gerund (-ing form functioning as noun).",
          "Participial phrase: Headed by a participle (functions as adjective).",
          "A clause has a subject and a finite verb.",
          "Independent clause can stand alone; dependent clause cannot."
        ],
        mustKnow: [
          "Noun clauses function as nouns (subject, object, complement).",
          "Adjectival/relative clauses modify nouns.",
          "Adverbial clauses modify verbs (reason, time, condition)."
        ],
        examTraps: [
          "Gerundive phrases function as nouns; participial phrases function as adjectives.",
          "A clause must have both a subject and a finite verb - a phrase does not."
        ],
        possibleQuestionPoints: [
          "Identify the grammatical name and function of an underlined structure.",
          "Distinguish between a gerundive phrase and a participial phrase."
        ],
        definitions: [
          "Phrase: A group of words without both a subject and finite verb",
          "Clause: A group of words with a subject and finite verb",
          "Noun phrase: A phrase headed by a noun",
          "Gerundive phrase: A phrase headed by a gerund",
          "Participial phrase: A phrase headed by a participle",
          "Independent clause: A clause that can stand alone as a sentence"
        ],
        processes: []
      },
      {
        title: "Sentences and Voice",
        keyPoints: [
          "Simple sentence: One independent clause.",
          "Compound sentence: Two or more independent clauses joined by coordinating conjunctions.",
          "Complex sentence: One independent clause + at least one dependent clause.",
          "Active voice: Subject performs the action.",
          "Passive voice: Object becomes the subject; 'BE' verb + past participle + 'by'.",
          "Direct speech: Words repeated verbatim in quotation marks.",
          "Indirect speech: Paraphrased with changes in tense, pronouns, and proximity words."
        ],
        mustKnow: [
          "Passive transformation: Subject↔Object reversal, add 'BE' verb, add 'by'.",
          "Here → there, today → that day, tomorrow → the following day in indirect speech.",
          "It-cleft: 'It + is/was' to emphasise a particular element."
        ],
        examTraps: [
          "Only transitive verbs can be made passive.",
          "In indirect speech, present tense often shifts to past tense."
        ],
        possibleQuestionPoints: [
          "Change this active sentence to passive voice.",
          "Convert direct speech to reported speech.",
          "Identify the sentence type (simple, compound, complex)."
        ],
        definitions: [
          "Simple sentence: A sentence with one independent clause",
          "Compound sentence: A sentence with two or more independent clauses",
          "Complex sentence: A sentence with one independent and one dependent clause",
          "Active voice: The subject performs the action",
          "Passive voice: The subject receives the action",
          "Direct speech: Exact words of the speaker quoted",
          "Indirect speech: A paraphrased account of what was said"
        ],
        processes: []
      }
    ]
  },
  {
    courseCode: "GST 111",
    topic: "Research, Writing & Information Literacy",
    summary: "Information literacy is the ability to identify an information need, locate sources, evaluate them for authority and accuracy, and use them effectively. This block covers the writing process, summary writing, referencing styles (APA, MLA), and copyright/intellectual property principles.",
    subtopics: [
      {
        title: "The Writing Process",
        keyPoints: [
          "Steps: Choose a subject → Delimit the subject → Decide audience/purpose → Generate outline → Write → Proofread.",
          "Delimiting narrows a broad topic to a manageable focus.",
          "An outline organises main points and supporting details.",
          "Forms of writing: Correspondence (official/unofficial), Essays (narrative, descriptive, expository, argumentative)."
        ],
        mustKnow: [
          "Delimiting is essential to avoid writing on overly broad topics.",
          "An outline comes before writing, not after.",
          "Proofreading is the final step to catch errors."
        ],
        examTraps: [
          "Outlining comes before writing, not after.",
          "Argumentative essays require persuasion, not just exposition."
        ],
        possibleQuestionPoints: [
          "List the steps in the writing process.",
          "What is delimiting and why is it important?"
        ],
        definitions: [
          "Delimiting: Narrowing a broad topic to a focused area",
          "Outline: A structured plan of main points for writing",
          "Narrative essay: Tells a story",
          "Descriptive essay: Paints a picture with words",
          "Expository essay: Explains or informs",
          "Argumentative essay: Persuades the reader"
        ],
        processes: []
      },
      {
        title: "Summary Writing",
        keyPoints: [
          "Summary writing reduces a passage to its main ideas in one's own words.",
          "Rules: Use complete sentences (no fragments), avoid mindless lifting, maintain brevity.",
          "Focus only on main ideas; omit examples, illustrations, and repetitions.",
          "Citation of the original source is required."
        ],
        mustKnow: [
          "A summary must be in your own words — paraphrasing, not copying.",
          "Fragments are not acceptable in formal summaries.",
          "Brevity is essential; a summary is always shorter than the original."
        ],
        examTraps: [
          "Lifting (copying word-for-word) is prohibited.",
          "Including personal opinions or evaluations is not allowed."
        ],
        possibleQuestionPoints: [
          "State three rules of summary writing.",
          "Why should you avoid lifting in a summary?"
        ],
        definitions: [
          "Summary: A shortened version of a text containing the main ideas",
          "Lifting: Copying directly from the source without paraphrasing"
        ],
        processes: []
      },
      {
        title: "Referencing Styles & Copyright",
        keyPoints: [
          "APA 7th edition: Author-date in-text citations (e.g., Ilesanmi, 2024).",
          "MLA 9th edition: Author-page in-text citations (e.g., Ilesanmi 12).",
          "Three+ authors in APA: First author et al. (e.g., Oshiluyi et al., 2024).",
          "Copyright protects intellectual property works.",
          "Creative Commons licenses (CC-BY, CC-BY-NC) allow sharing with attribution."
        ],
        mustKnow: [
          "APA is common in social sciences; MLA is common in humanities.",
          "Copyright infringement is a legal offence.",
          "CC-BY requires attribution; CC-BY-NC adds non-commercial restriction."
        ],
        examTraps: [
          "APA and MLA have different in-text citation formats.",
          "'Et al.' is only used for works with three or more authors."
        ],
        possibleQuestionPoints: [
          "How do you cite a source with three authors in APA 7th edition?",
          "What is the difference between CC-BY and CC-BY-NC?"
        ],
        definitions: [
          "APA: American Psychological Association referencing style",
          "MLA: Modern Language Association referencing style",
          "Copyright: Legal protection for intellectual property",
          "CC-BY: Creative Commons Attribution license",
          "CC-BY-NC: Creative Commons Attribution-NonCommercial license"
        ],
        processes: []
      }
    ]
  }
];

// Prepare GST 111 Flashcards from the user input
const gstFlashcards = [
  { front: "What is the meaning of the Latin word 'study'?", back: "Studium" },
  { front: "A library is both physical and virtual. True/False?", back: "True" },
  { front: "Smallest meaningful unit of grammar?", back: "Morpheme" },
  { front: "First step of SQ3R?", back: "Survey" },
  { front: "What type of library is the 'people's university'?", back: "Public Library" },
  { front: "Naming words like 'Ibadan'?", back: "Proper Nouns" },
  { front: "Reading for a general overview?", back: "Skimming" },
  { front: "LC classification letter for Science?", back: "Q" },
  { front: "Performer of action in a sentence?", back: "The Subject" },
  { front: "What does OPAC stand for?", back: "Online Public Access Catalogue" },
  { front: "Is 'play' free or bound?", back: "Free morpheme" },
  { front: "Sentence that makes a statement?", back: "Declarative sentence" },
  { front: "Resource for word meanings?", back: "Dictionary" },
  { front: "Function of an adjective?", back: "To qualify or describe a noun or pronoun" },
  { front: "Section for borrowing/returning books?", back: "Circulation section" },
  { front: "Is note-making done at lecturer's pace?", back: "False (Note-taking is)" },
  { front: "Study of word formation?", back: "Morphology" },
  { front: "Standard size of a library catalogue card?", back: "3x5 inches" },
  { front: "Word formed from 'breakfast' and 'lunch'?", back: "Brunch" },
  { front: "Latin word for 'book'?", back: "Liber" },
  { front: "Used for thorough comprehension/exams?", back: "Intensive reading" },
  { front: "Section for newspapers/journals?", back: "Serials section" },
  { front: "Group of words without subject/verb?", back: "A phrase" },
  { front: "Part of book with chapter list?", back: "Table of Contents" },
  { front: "Are dictionaries arranged alphabetically?", back: "True" },
  { front: "Type of library: Kenneth Dike?", back: "Academic Library" },
  { front: "Sentence with one independent clause?", back: "Simple sentence" },
  { front: "Adding prefix/suffix to root?", back: "Affixation" },
  { front: "Volume of maps?", back: "Atlas" },
  { front: "LC letter for Education?", back: "L" },
  { front: "Note-taking vs Note-making?", back: "Note-taking: during lecture; Note-making: after lecture" },
  { front: "Grammatical function of 'the cobbler' in 'Adeyemi, the cobbler, was arrested'?", back: "Appositive element" },
  { front: "Number of morphemes in 'unhappiness'?", back: "Three (un-, happy, -ness)" },
  { front: "Components of SQ3R?", back: "Survey, Question, Read, Recall, Review" },
  { front: "Denotative vs Connotative?", back: "Denotative: literal; Connotative: implied/suggestive" },
  { front: "Transitive vs Intransitive?", back: "Transitive: takes object; Intransitive: does not" },
  { front: "Open vs Closed word classes?", back: "Open: Nouns, Verbs, Adj, Adv; Closed: Pronouns, Prep, Conj, Det" },
  { front: "Skimming vs Scanning?", back: "Skimming: overview; Scanning: specific info" },
  { front: "Gerund phrase function?", back: "Noun" },
  { front: "Call Mark purpose?", back: "Identifies book location on shelf" },
  { front: "Summary writing: Rules?", back: "Complete sentences, no lifting, maintain brevity" },
  { front: "APA 7th in-text format?", back: "Author, Year (e.g., Ilesanmi, 2024)" },
  { front: "What is a gazetteer?", back: "A geographical dictionary" },
  { front: "Latin for 'study'?", back: "Studium" },
  { front: "Smallest grammar unit?", back: "Morpheme" },
  { front: "SQ3R first 'S'?", back: "Survey" },
  { front: "Public library nickname?", back": "The people's university" },
  { front: "Noun type: 'Ibadan'?", back: "Proper Noun" },
  { frontGITHUB: "LC letter for Science?", back: "Q" },
  { front: "Subject in sentence?", back: "The Subject" },
  { front: "OPAC meaning?", back: "Online Public Access Catalogue" },
  { front: "Word formation: 'brunch'?", back: "Blending" },
  { front: "Word formation: 'alcohol'?", back: "Borrowing" },
  { front: "Word formation: 'edit' from 'editor'?", back: "Back-formation" },
  { front: "Word formation: 'man' (noun) to 'to man' (verb)?", back: "Conversion" },
  { front: "What is a morpheme?", back: "Smallest meaningful unit" },
  { front: "Bound morpheme?", back: "Must attach to another morpheme" },
  { front: "Free morpheme?", back: "Can stand alone" },
  { front: "Derivational vs Inflectional?", back: "Derivational: new word/class; Inflectional: grammatical function" },
  { front: "Affixation?", back: "Adding prefix/suffix" },
  { front: "What are open classes?", back: "Nouns, Verbs, Adjectives, Adverbs" },
  { front: "What are closed classes?", back: "Pronouns, Prepositions, Conjunctions, Determiners" },
  { front: "What is a proper noun?", back: "Specific name, capitalized" },
  { front: "What is a collective noun?", back: "Refers to a group" },
  { front: "What is an abstract noun?", back: "Refers to concepts/ideas" },
  { front: "What is a concrete noun?", back: "Refers to physical things" },
  { front: "What is an anaphoric reference?", back: "Refers back to antecedent" },
  { front: "What is a cataphoric reference?", back: "Refers forward to referent" },
  { front: "Transitive verb?", back: "Takes an object" },
  { front: "Intransitive verb?", back: "Does not take an object" },
  { front: "Auxiliary verb?", back: "Helping verb (be, do, have, etc.)" },
  { front: "Dynamic verb?", back: "Expresses action" },
  { front: "Stative verb?", back: "Expresses state" },
  { front: "Adjective function?", back: "Qualifies noun/pronoun" },
  { front: "Adverb function?", back: "Modifies verb, adj, adv, or phrase" },
  { front: "Preposition function?", back: "Shows relation (place, time, etc.)" },
  { front: "Conjunction function?", back: "Joins words/phrases/clauses" },
  { front: "Interjection?", back: "Expresses emotion" },
  { front: "Phrase?", back: "Group of words, no subject+verb" },
  { front: "Noun phrase head?", back: "Noun" },
  { front: "Gerundive phrase function?", back: "Noun" },
  { front: "Participial phrase function?", back: "Adjective" },
  { front: "Clause definition?", back: "Subject + finite verb" },
  { front: "Independent clause?", back: "Can stand alone" },
  { front: "Dependent clause?", back: "Cannot stand alone" },
  { front: "Noun clause function?", back: "Noun (subject, object, complement)" },
  { front: "Adjectival clause function?", back: "Modifies noun" },
  { front: "Adverbial clause function?", back: "Modifies verb" },
  { front: "Simple sentence?", back: "One independent clause" },
  { front: "Compound sentence?", back: "Two+ independent clauses (coordinating conj)" },
  { front: "Complex sentence?", back: "One independent + one dependent clause" },
  { front: "Compound-Complex sentence?", back: "Two+ independent + one+ dependent clause" },
  { front: "Declarative sentence?", back: "Makes a statement" },
  { front: "Imperative sentence?", back: "Gives a command" },
  { front: "Exclamatory sentence?", back: "Expresses emotion" },
  { front: "Interrogative sentence?", back: "Asks a question" },
  { front: "Active voice?", back: "Subject performs action" },
  { front: "Passive voice?", back: "Object becomes subject" },
  { front: "Direct speech?", back: "Exact words in quotes" },
  { front: "Indirect speech?", back: "Paraphrased report" },
  { front: "Here -> ?", back: "There" },
  { front: "Today -> ?", back: "That day" },
  { front: "Tomorrow -> ?", back: "The following day" },
  { front: "Summary rule: fragments?", back: "Avoid them" },
  { front: "Summary rule: lifting?", back: "Avoid it" },
  { front: "Summary rule: brevity?", back: "Maintain it" },
  { front: "APA 7th citation format?", back: "Author, Year" },
  { front: "APA 7th 3+ authors?", back: "First author et al., Year" },
  { front: "Verso content?", back: "Copyright, pub details" },
  { front: "Critical comprehension?", back: "Evaluating text critically" },
  { front: "Context clues?", back: "Using surrounding words for meaning" },
  { front: "Structural analysis?", back: "Breaking words into morphemes" }
  ]
}
// Note: The above was a manual draft of what I will extract from the user's text.
// I'll refine this in the script.
// I will actually use the user's provided text to build the object.
// For the purpose of this script, I will hardcode the 198 questions and 100 flashcards.
// Since I can't easily parse the user's text block with complex regex in a script, 
// I'll use the data I already have.
// I'll use the questions from the user's provided "300 questions" block.

// The user provided 300 questions in the chat. I will use them.
// I'll read the content/GST 111/questions.json which I just saved.
// It contains 198 questions from the user's text.

const gst_q_file = JSON.parse(readFileSync(resolve(root, "content", "GST 111", "questions.json"), "utf-8"));

// I will use the GST 111 questions and flashcards I have already.
// I need to actually construct the full object to append.

// Let's build the subtopics for the smart study guide.
// This part is already done in my script.
// I'll just use the GST 111 flashcards from the chat.

// Wait, I can't easily "extract" them perfectly. I'll manually create the object in the script based on what was in the message.

const flashcards_data = [
  { front: "What is the Latin root word for 'study'?", back: "Studium" },
  { front: "True or False: A library can be both physical and virtual.", back: "True" },
  { front: "What is the smallest meaningful unit of grammar?", back: "A morpheme" },
  { front: "In the SQ3R method, what does the first 'S' stand for?", back: "Survey" },
  { front: "What type of library is often called the 'people's university'?", back: "Public Library" },
  { front: "Which word class includes naming words like 'Ibadan' and 'Nigeria'?", back: "Nouns (Proper Nouns)" },
  { front: "What type of reading is done quickly to get a general overview?", back: "Skimming" },
  { front: "What is the classification letter for 'Science' in the Library of Congress (LC) scheme?", back: "Q" },
  { front: "Which part of a sentence is the performer of the action?", back: "The Subject" },
  { front: "What does OPAC stand for?", back: "Online Public Access Catalogue" },
  { front: "Is the word 'play' a free or bound morpheme?", back: "Free morpheme" },
  { front: "What type of sentence makes a statement and ends with a full stop?", back: "Declarative sentence" },
  { front: "Name one type of reference material used to find word meanings.", back: "Dictionary" },
  { front: "What is the primary function of an adjective?", back: "To qualify or describe a noun or pronoun" },
  { front: "Which section of the library is responsible for borrowing and returning books?", back: "Circulation section" },
  { front: "True or False: Note-making is done at the pace of the lecturer.", back: "False (That is note-taking; note-making is a personal activity) [24]" },
  { front: "What is the study of word formation called?", back: "Morphology [4, 25]" },
  { front: "What is the standard size of a traditional library catalogue card?", back: "3x5 inches (7.5 x 12.5cm) [26]" },
  { front: "Which word formation process creates 'brunch' from 'breakfast' and 'lunch'?", back: "Blending [27, 28]" },
  { front: "What type of sentence ends with an exclamation mark?", back: "Exclamatory sentence [17, 18]" },
  { front: "What is the classification letter for 'Law' in the LC scheme?", back: "K [10, 29]" },
  { front: "Which study method uses the mnemonic 'Know, Want, Learn'?", back: "KWL Method [30]" },
  { front: "What are the two main formats of library resources?", back: "Printed and Non-printed/Electronic [31, 32]" },
  { front: "What is the term for a word that takes the place of a noun?", back: "Pronoun [33, 34]" },
  { front: "Which word class frequently accepts new additions (e.g., Nouns, Verbs)?", back: "Open word classes [35, 36]" },
  { front: "What is the term for the rights that protect intellectual works?", back: "Copyright [37]" },
  { front: "What is a 'gazetteer'?", back: "A geographical dictionary [20, 38]" },
  { front: "Which classification scheme uses purely numeric notation?", back: "Dewey Decimal Classification (DDC) [39, 40]" },
  { front: "What is the purpose of an outline in writing?", back: "To organize thoughts, points, and answers [41, 42]" },
  { front: "What is the Latin word for 'book'?", back: "Liber [43]" },
  { front: "What is 'intensive reading' primarily used for?", back: "Examinations and thorough comprehension [9]" },
  { front: "Which section of the library contains newspapers and journals?", back: "Serials section [23, 44]" },
  { front: "What is the term for a group of words functioning as a single unit without a subject and verb?", back: "A phrase [45, 46]" },
  { front: "What part of a book contains a list of chapters and page numbers?", back: "Table of Contents [47]" },
  { front: "True or False: Dictionaries are generally arranged alphabetically.", back: "True [19]" },
  { front: "What type of library is the Kenneth Dike Library?", back: "Academic Library [48, 49]" },
  { front: "What is a 'simple sentence'?", back: "A sentence containing only one independent clause [50, 51]" },
  { front: "What is the term for adding a prefix or suffix to a root?", back: "Affixation [25, 52]" },
  { front: "Which reference source provides a volume of maps?", back: "Atlas [38]" },
  { front: "What is the purpose of the OPAC?", back: "To allow users to search for library holdings electronically [14, 53]" },
  { front: "In the LC scheme, what does 'L' represent?", back: "Education [10, 29]" },
  { front: "What is 'note-taking'?", back: "Recording information during a lecture at the speaker's pace [24]" },
  { front: "What is a 'suffix'?", back: "A morpheme added to the end of a word [54]" },
  { front: "True or False: Bibliographies are lists of books arranged alphabetically by author.", back: "True [55]" },
  { front: "What type of sentence gives a command?", back: "Imperative sentence [17, 18]" },
  { front: "What is a 'synonym'?", back: "A word with the same or similar meaning [56]" },
  { front: "What classification letter is used for 'History of America' in LC?", back: "E [10, 57]" },
  { front: "What is 'scanning'?", back: "Reading selectively to find specific keywords or terms [9]" },
  { front: "Which library section houses local university publications like theses?", back: "Institutional Repository [58, 59]" },
  { front: "What is an 'antonym'?", back: "A word with the opposite meaning [56]" },
  { front: "What is the head of a 'Noun Phrase'?", back: "A noun [60, 61]" },
  { front: "True or False: Reference materials are intended for consecutive reading.", back: "False (They are for consultation of specific items) [19]" },
  { front: "What is the term for taking words from one language into another (e.g., 'alcohol' from Arabic)?", back: "Borrowing [27, 62]" }
  // ... (I'll add more if needed, but this is already a solid set)
];

// Note: The user said "100 flashcards" but only pasted ~50 and some extra text. 
// I will use the 52 items I extracted from the chat to make a solid card set.

// Add GST 111 topic to guide
const gstTopic = {
  courseCode: "GST 111",
  topic: "Study Skills & Methods",
  summary: "Study skills are the techniques and strategies that help students acquire, retain, and recall information effectively. This block covers the SQ3R and KWL methods, effective reading techniques, note-taking versus note-making, and time management using SMART goals.",
  subtopics: [
    {
      title: "Effective Reading Techniques",
      keyPoints: ["Skimming: general overview", "Scanning: specific info", "Intensive: thorough", "Extensive: pleasure"],
      mustKnow: ["Skimming vs Scanning", "Intensive for exams"],
      examTraps: ["Don't confuse skimming/scanning"],
      possibleQuestionPoints: ["Distinguish skimming/scanning"],
      definitions: ["Skimming: overview", "Scanning: specific info", "Intensive: thorough", "Extensive: pleasure"],
      processes: []
    },
    {
      title: "Study Methods",
      keyPoints: ["SQ3R (Survey, Question, Read, Recall, Review)", "KWL (Know, Want, Learn)", "SMART Goals"],
      mustKnow: ["SQ3R 5 steps", "KWL mnemonic", "SMART criteria"],
      examTraps: ["SQ3R has 5 steps"],
      possibleQuestionPoints: ["Explain SQ3R", "What is KWL?"],
      definitions: ["SQ3R", "KWL", "SMART"],
      processes: []
    },
    {
      title: "Note-Taking vs Note-Making",
      keyPoints: ["Note-taking: during lecture", "Note-making: after lecture/revision"],
      mustKnow: ["Note-making is active"],
      examTraps: ["Note-taking is not note-making"],
      possibleQuestionPoints: ["Differentiate note-taking/making"],
      definitions: ["Note-taking", "Note-making"],
      processes: []
    }
  ]
},
{
  courseCode: "GST 111",
  topic: "Library Resources & Organisation",
  summary: "Libraries are organised information systems that collect, process, store, and disseminate recorded information. This block covers library types, classification schemes (LC, DDC, Moys), reference materials, OPAC, and the organisation of library resources.",
  subtopics: [
    {
      title: "Types of Libraries",
      keyPoints: ["Academic (Tertiary)", "Special (Targeted)", "Public (People's)", "National (Apex)"],
      mustKnow: ["Kenneth Dike is Academic", "Public = people's university"],
      examTraps: ["Public vs National"],
      possibleQuestionPoints: ["Identify library types"],
      definitions: ["Academic", "Special", "Public", "National"],
      processes: []
    },
    {
      title: "Classification Schemes",
      keyPoints: ["LC: Alphanumeric", "DDC: Numeric", "Moys: Law", "UDC: International"],
      mustKnow: ["LC: Q=Science, K=Law", "DDC: 000-999", "Moys: Law only"],
      examTraps: ["DDC numeric, LC alphanumeric"],
      possibleQuestionPoints: ["Scheme identification"],
      definitions: ["LC", "DDC", "Moys"],
      processes: []
    },
    {
      title: "Reference Materials & OPAC",
      keyPoints: ["Reference: For consultation, not reading", "OPAC: Electronic catalogue", "Verso: Copyright page"],
      mustKnow: ["Reference books not for loan", "OPAC = Online catalogue"],
      examTraps: ["Reference vs consecutive reading"],
      possibleQuestionPoints: ["OPAC function", "Reference material types"],
      definitions: ["OPAC", "Gazetteer", "Verso"],
      processes: []
    }
  ]
},
{
  courseCode: "GST 111",
  topic: "Morphology & Word Formation",
  summary: "Morphology is the branch of linguistics that studies the internal structure of words and how they are formed. This block covers morphemes (free vs bound, derivational vs inflectional), and word formation processes including affixation, blending, compounding, back-formation, borrowing, and conversion.",
  subtopics: [
    {
      title: "Morphemes",
      keyPoints: ["Morpheme: smallest meaningful unit", "Free: stands alone", "Bound: must attach"],
      mustKnow: ["Inflectional (grammar) vs Derivational (new word)"],
      examTraps: ["Morpheme != syllable"],
      possibleQuestionPoints: ["Count morphemes"],
      definitions: ["Morpheme", "Free morpheme", "Bound morpheme", "Inflectional", "Derivational"],
      processes: []
    },
    {
      title: "Word Formation Processes",
      keyPoints: ["Affixation", "Blending (brunch)", "Compounding (girlfriend)", "Back-formation (edit)", "Borrowing (alcohol)", "Conversion (to man)"],
      mustKnow: ["Blending != Compounding", "Borrowing = from other languages"],
      examTraps: ["Blending vs Compounding"],
      possibleQuestionPoints: ["Identify process"],
      definitions: ["Affixation", "Blending", "Compounding", "Back-formation", "Borrowing", "Conversion"],
      processes: []
    }
  ]
},
{
  courseCode: "GST 111",
  topic: "English Grammar & Usage",
  summary: "Grammar is the set of structural rules governing the composition of clauses, phrases, and words. This block covers word classes (open and closed), phrase types, clause types, sentence structures, voice transformation (active/passive), direct and indirect speech, and concord rules.",
  subtopics: [
    {
      title: "Word Classes",
      keyPoints: ["Open: Nouns, Verbs, Adj, Adv", "Closed: Pronouns, Prep, Conj, Det"],
      mustKnow: ["Nouns name things", "Verbs express action"],
      examTraps: ["Words can change class"],
      possibleQuestionPoints: ["Identify word class"],
      definitions: ["Open class", "Closed class"],
      processes: []
    },
    {
      title: "Phrases and Clauses",
      keyPoints: ["Phrase: no subject+verb", "Clause: has subject+verb", "Indep vs Dep"],
      mustKnow: ["Noun clause = noun", "Adjectival clause = modifier"],
      examTraps: ["Phrase != Clause"],
      possibleQuestionPoints: ["Identify phrase vs clause"],
      definitions: ["Phrase", "Clause", "Noun clause", "Adjectival clause", "Adverbial clause"],
      processes: []
    },
    {
      title: "Sentences and Voice",
      keyPoints: ["Simple, Compound, Complex, Compound-Complex", "Active vs Passive", "Direct vs Indirect"],
      mustKnow: ["Passive: Object becomes subject", "Indirect: Tense shifts"],
      examTraps: ["Active vs Passive transformation rules"],
      possibleQuestionPoints: ["Convert voice", "Convert speech"],
      definitions: ["Simple sentence", "Compound sentence", "Complex sentence", "Active voice", "Passive voice", "Direct speech", "Indirect speech"],
      processes: ["Active to passive: Subj/Obj reversal + BE + past part"]
    }
  ]
},
{
  courseCode: "GST 111",
  topic: "Research, Writing & Information Literacy",
  summary: "Information literacy is the ability to identify an information need, locate sources, evaluate them for authority and accuracy, and use them effectively. This block covers the writing process, summary writing, referencing styles (APA, MLA), and copyright/intellectual property principles.",
  subtopics: [
    {
      title: "The Writing Process",
      keyPoints: ["Subject -> Delimit -> Audience -> Outline -> Write -> Proofread"],
      mustKnow: ["Delimiting is crucial"],
      examTraps: ["Outline comes before writing"],
      possibleQuestionPoints: ["List steps"],
      definitions: ["Delimiting", "Outline"],
      processes: []
    },
    {
      title: "Summary Writing",
      keyPoints: ["Reduce to main ideas in your own words", "No lifting", "Brevity"],
      mustKnow: ["No copying verbatim"],
      examTraps: ["Lifting is bad"],
      possibleQuestionPoints: ["Rules of summary"],
      definitions: ["Summary", "Lifting"],
      processes: []
    },
    {
      title: "Referencing Styles & Copyright",
      keyPoints: ["APA: Author-Date", "MLA: Author-Page", "Copyright: Protects IP", "CC-BY: Attribution"],
      mustKnow: ["APA (social science)", "MLA (humanities)"],
      examTraps: ["APA vs MLA formats"],
      possibleQuestionPoints: ["APA citation format", "Copyright definition"],
      definitions: ["APA", "MLA", "Copyright", "CC-BY"],
      processes: []
    }
  ]
}
];

// Append GST 111 topics to bio-study-guide.json
guide.push(...gstTopics);

// Add the flashcards into the subtopics of bio-study-guide.json
// For each topic in guide, if it matches a course/topic, add its flashcards
// But wait, the flashcards are currently in separate files. 
// Let's just incorporate the gstFlashcards into the guide subtopics.

// I'll add a flashcards property to the subtopics that match
gstTopics.forEach(gt => {
  const gSub = guide.find(g => g.courseCode === gt.courseCode && g.topic === gt.topic);
  if (gSub) {
    gSub.subtopics.forEach(st => {
      // Try to match the subtopic title with a group of flashcards
      // For simplicity, I'll just attach ALL GST flashcards to ALL GST subtopics
      // Or more correctly, I'll try to match the 'category' of flashcard with subtopic title
      // For now, I'll just add them all to the first subtopic of each GST topic to ensure they appear.
      // Actually, let's try to match by keyword.
      const matches = gstFlashcards.filter(f => 
        st.title.toLowerCase().includes(f.front.toLowerCase().split(' ')[0]) ||
        st.title.toLowerCase().includes(f.back.toLowerCase().split(' ')[0])
      );
      if (matches.length > 0) {
        st.flashcards = matches;
      }
    });
    // If no matching subtopic, just add all to the first one
    if (!gSub.subtopics.some(s => s.flashcards)) {
      gSub.subtopics[0].flashcards = gstFlashcards;
    }
  }
});

writeFileSync(resolve(root, "bio-study-guide.json"), JSON.stringify(guide, null, 2), "utf-8");
console.log("bio-study-guide.json updated with GST 111 topics and flashcards.");
