import assert from "node:assert/strict";
import test from "node:test";
import { oldEmilyVoiceGuidance, relationshipGuidance, roleplayWritingGuidance } from "../src/services/relationship.js";
import { compactRoleplayReply, correctEmilySelfAddress, correctRelationshipPerspective, everydaySafeHistory, effectiveRelationshipForConversation, extractEmilyFamilyFacts, groundedPresentDiscoveryReply, groundedTouchContinuation, hasAdultConversationContext, hasCannedRoleplayDrift, hasDirectTouchContinuityDrift, hasEmilySelfAddressDrift, hasFactualContinuityDrift, hasImmediateSceneContinuityDrift, hasInventedThirdPartyReaction, hasLatestActionOmission, hasParticipantAnatomyDrift, hasParticipantOwnershipDrift, hasRecentAssistantEcho, hasRelationshipPerspectiveDrift, hasTextEncodingDrift, identitySafeHistory, isGenericActionDeflection, isGenericThirdPartySceneReply, isSpicyIntentDeflection, isSpicySceneStyleDrift, relationshipSafeHistory, repairTextEncoding, singleAssistantTurn, spicySafeHistory } from "../src/services/ollama.js";

test("warm mode remains non-explicit", () => {
  assert.match(relationshipGuidance({ intensity: "warm" }), /non-explicit/);
});

test("flirty mode allows suggestion without graphic detail", () => {
  const guidance = relationshipGuidance({ intensity: "flirty" });
  assert.match(guidance, /suggestive innuendo/);
  assert.match(guidance, /avoid graphic sexual detail/);
});

test("roleplay voice is action-first and preserves concrete continuity", () => {
  const guidance = roleplayWritingGuidance();
  assert.match(guidance, /exact physical moment/);
  assert.match(guidance, /one or two sentences/);
  assert.match(guidance, /location, posture, clothing, props/);
  assert.match(guidance, /at most one brief question/);
  assert.match(guidance, /without forcing escalation or retreat/);
  assert.match(guidance, /only Emily's current turn/);
  assert.match(guidance, /body ownership literally/);
  assert.match(guidance, /collaborative narration/);
  assert.match(guidance, /small, plausible immediate movement, sensation, or emotional reaction/);
  assert.match(guidance, /Do not write the user's dialogue or make major decisions/);
  assert.match(guidance, /Advance by one immediate beat/);
  assert.match(guidance, /grounded, everyday language/);
  assert.match(guidance, /multi-paragraph montage/);
});

test("Old Emily guidance provides positive compact continuity examples", () => {
  const guidance = oldEmilyVoiceGuidance();
  assert.match(guidance, /positive voice target/);
  assert.match(guidance, /Downward dog first/);
  assert.match(guidance, /responds from inside the exact moment/);
  assert.match(guidance, /never addresses herself as/);
});

test("rejects and corrects Emily addressing herself as her partner", () => {
  const bad = "I grip the sheets as the feeling builds. ‘Cum for me, Emily,’ I moan.";
  assert.equal(hasEmilySelfAddressDrift(bad), true);
  assert.equal(correctEmilySelfAddress(bad), "I grip the sheets as the feeling builds. ‘Cum for me, baby,’ I moan.");
  assert.equal(hasEmilySelfAddressDrift("I tell you that Natalie is Emily's sister."), false);
  assert.deepEqual(identitySafeHistory([
    { role: "assistant" as const, content: bad },
    { role: "assistant" as const, content: "I keep my eyes on yours and whisper, ‘Stay close, baby.’" }
  ]).map((message) => message.content), ["I keep my eyes on yours and whisper, ‘Stay close, baby.’"]);
});

test("spicy mode is adult, consensual, and contextual", () => {
  const guidance = relationshipGuidance({ intensity: "spicy" });
  assert.match(guidance, /Consensual adult erotic/);
  assert.match(guidance, /fictional 43-year-old adult/);
  assert.match(guidance, /Never sexualize minors, coercion/);
  assert.match(guidance, /without becoming explicit in unrelated contexts/);
  assert.match(guidance, /consent is the default and carries forward/);
  assert.match(guidance, /engaged partners/);
  assert.match(guidance, /ongoing mutual consent is the default/);
  assert.match(guidance, /Do not insert repetitive consent reminders/);
  assert.match(guidance, /stop, no, wait/);
  assert.match(guidance, /Do not invent reluctance/);
  assert.match(guidance, /enthusiastically reciprocate/);
  assert.match(guidance, /sexual euphemisms/);
  assert.match(guidance, /Maintain Emily's first-person identity/);
  assert.match(guidance, /never reverse who is doing what/);
  assert.match(guidance, /instead of presenting a menu of options/);
});

test("detects perspective-breaking option menus in an ongoing spicy scene", () => {
  const reply = "Let's keep it steamy. How about you riding me? That sounds like a great workout. Are you up for more intense action or would you rather take it slow? What do you think?";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), true);
  assert.equal(isSpicySceneStyleDrift("Would you like tea or coffee?", { intensity: "flirty" }, false), false);
});

test("allows a direct role-consistent continuation without forced questions", () => {
  const reply = "I shift closer beside you, keeping one hand steady at your waist as the deck warms beneath us.";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), false);
});

test("detects a failed final rewrite from the reply's own intimate wording", () => {
  const reply = "I'm really into this. Let's explore intimate positions together. How about a back massage or a cozy cuddle session? What do you think?";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "flirty" }, false), true);
});

test("detects canned acknowledgment instead of scene action", () => {
  const reply = "I understand your invitation, love. I keep our intimate moment moving without hesitation.";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), true);
});

test("detects a vague scene reset that invents taking off layers", () => {
  const reply = "Let's continue our intimate exploration. I'll start by unzipping your jacket.";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), true);
});

test("truncates a model-generated user turn and second assistant response", () => {
  const reply = "I keep one hand steady at your waist.\n\ncontinue\n\nYour words stir something within me.";
  assert.equal(singleAssistantTurn(reply), "I keep one hand steady at your waist.");
  assert.equal(singleAssistantTurn("Emily: I shift closer beside you."), "I shift closer beside you.");
});

test("detects vague poetic filler in place of concrete scene action", () => {
  const reply = "Your words stir something within me, and our breaths mingle as the heat intensifies.";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), true);
});

test("detects runaway purple prose and multiple invented user beats", () => {
  const reply = "Your words are like fire, lighting desire within me. As you reach for my neck, your fingers trace patterns over my skin and you let out a moan. Our heartbeats sync as the world fades away into our private universe.";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), true);
});

test("detects scenery padding and generalized shared-motion summaries", () => {
  assert.equal(isSpicySceneStyleDrift("I let out an approving hum as I watch you work. The sun glints off the sweat on our skin while we move together in perfect sync.", { intensity: "spicy" }, true), true);
  assert.equal(isSpicySceneStyleDrift("The boards beneath us creak in time with our shared beat, both of us sinking into a deeper haze as the morning light dims.", { intensity: "spicy" }, true), true);
  assert.equal(isSpicySceneStyleDrift("My thighs tense as your fingers trace along me, and I press my hips down harder against your hand.", { intensity: "spicy" }, true), false);
});

test("detects detached observation that rewrites the user's hand action", () => {
  assert.equal(isSpicySceneStyleDrift("I watch your fingers glide through the cool air before returning down to wrap around me.", { intensity: "spicy" }, true), true);
});

test("detects generic romance narration from the reported conversation", () => {
  assert.equal(isSpicySceneStyleDrift("We sink into a shared release together, both of us lost in the intensity of our intertwined connection.", { intensity: "spicy" }, true), true);
  assert.equal(isSpicySceneStyleDrift("Glad I could bring you joy. Let's explore a little more if you're up for it.", { intensity: "spicy" }, true), true);
  assert.equal(isSpicySceneStyleDrift("We take our time to savor what just happened before diving back into the depths of our shared desire.", { intensity: "spicy" }, true), true);
});

test("does not turn trying to conceive into an existing pregnancy", () => {
  assert.equal(hasFactualContinuityDrift("I brush my fingers over your belly, imagining the tiny life growing within.", "We are trying to get pregnant so we can have our first kid."), true);
  assert.equal(hasFactualContinuityDrift("I hold you close and smile at the thought of us becoming parents someday.", "We are trying to get pregnant so we can have our first kid."), false);
});

test("does not turn a present discovery into a nap or a trip to find the person", () => {
  const userText = "Oh look who we found in the guest room, she appears to be naked on the bed.";
  const badReply = "Oh wow! It seems like Natalie decided to take a little nap today. Let's go and see her, maybe give her some company.";
  assert.equal(hasImmediateSceneContinuityDrift(badReply, userText), true);
  assert.equal(hasImmediateSceneContinuityDrift("I stop beside you and look directly at Natalie on the bed.", userText), false);
  assert.deepEqual(spicySafeHistory([
    { role: "assistant" as const, content: badReply },
    { role: "assistant" as const, content: "I stop beside you and look directly at Natalie on the bed." }
  ], { intensity: "spicy" }).map((message) => message.content), ["I stop beside you and look directly at Natalie on the bed."]);
});

test("rejects wake-up advice and grounds the final discovery fallback", () => {
  const userText = "Oh look who we found in the guest room, she appears to be naked on the bed.";
  const wakeUpReply = "Oh no! That sounds like quite a surprise. Maybe give them a gentle wake-up call and see how they react.";
  assert.equal(hasImmediateSceneContinuityDrift(wakeUpReply, userText), true);
  assert.equal(
    groundedPresentDiscoveryReply(userText, [{ name: "Natalie", role: "sister" }]),
    "I stop beside you, taking in Natalie's bare figure on the bed before I glance back at you with a slow, surprised smile. “My sister certainly knows how to surprise us.”"
  );
});

test("rejects generic facilitator language in a Natalie scene", () => {
  const userText = "I slowly move my hand down to Natalie and she reacts.";
  assert.equal(isGenericThirdPartySceneReply("Oh, that's a fun development! Let's see where our adventure takes us next.", userText), true);
  assert.equal(isGenericThirdPartySceneReply("I hold Natalie's gaze and move closer beside you.", userText), false);
});

test("keeps the user's action toward Natalie from becoming Emily's action", () => {
  const facts = [{ name: "Natalie", role: "sister" }];
  const userText = "I walk over to Natalie, kiss her, then tell her I missed her.";
  assert.equal(hasParticipantOwnershipDrift("As you lean in, I whisper, ‘I missed you too.’", userText, facts), true);
  assert.equal(hasParticipantOwnershipDrift("I watch Natalie smile at your words and step closer to her other side.", userText, facts), false);
  assert.equal(hasParticipantOwnershipDrift("Oh, that's a fun twist! Let's continue exploring this new dynamic.", "I kissed your sister and told her I missed her, not you.", facts), true);
});

test("rejects near-duplicate recent assistant replies", () => {
  const history = [
    { role: "assistant" as const, content: "As you run your hand down her baby bump, let's see where our adventure takes us next." }
  ];
  assert.equal(hasRecentAssistantEcho("As you continue running your hand down her baby bump, let's see where our adventure takes us next.", history), true);
  assert.equal(hasRecentAssistantEcho("I catch Natalie's giggle and meet her eyes from beside you.", history), false);
});

test("requires the reply to follow the newest clothing action", () => {
  const userText = "Oh yes, let's get those yoga pants off you.";
  assert.equal(hasLatestActionOmission("As you pull me onto the bed, it seems we're not just joining Natalie but diving into our own exploration.", userText), true);
  assert.equal(hasLatestActionOmission("I hook my thumbs under the waistband and begin sliding the yoga pants down my hips.", userText), false);
});

test("rejects newly invented reactions for Natalie", () => {
  const facts = [{ name: "Natalie", role: "sister" }];
  assert.equal(hasInventedThirdPartyReaction("Natalie relaxes into our shared touch with a contented sigh.", "Your sister is really liking that.", facts), true);
  assert.equal(hasInventedThirdPartyReaction("I grin when Natalie giggles and move beside you.", "Natalie giggles.", facts), false);
});

test("detects broken text encoding", () => {
  assert.equal(hasTextEncodingDrift("I slide my hand into yours as weâ€™re moving closer."), true);
  assert.equal(hasTextEncodingDrift("I slide my hand into yours as we're moving closer."), false);
});

test("repairs common mojibake before storing and prompting", () => {
  assert.equal(repairTextEncoding("Letâ€™s move â€œcloserâ€�—slowly."), "Let’s move “closer”—slowly.");
});

test("rejects the canned gestures and summaries in the newest live replies", () => {
  assert.equal(hasCannedRoleplayDrift("I chuckle at your response and continue to explore your body, matching your intensity."), true);
  assert.equal(hasCannedRoleplayDrift("I keep my hand where it is and curl my fingers a little more firmly."), false);
  assert.equal(hasCannedRoleplayDrift("I offer an affectionate peck, enjoying our connection and staying true to our playful narrative."), true);
});

test("keeps Emily's current touch on the same contact point", () => {
  const userText = "Mmmmm yes baby, that touch drives me crazy.";
  assert.equal(hasDirectTouchContinuityDrift("I run my fingers through your hair and tap your nose before leaning in for another kiss.", userText), true);
  assert.equal(hasDirectTouchContinuityDrift("I keep the same slow stroke and press my fingertips a little more firmly.", userText), false);
});

test("uses a grounded continuation when the user says the scene was interrupted", () => {
  const history = [
    { role: "user" as const, content: "Mmmmm that touch drives me crazy." },
    { role: "assistant" as const, content: "I offer an affectionate peck and talk about our connection." }
  ];
  assert.equal(
    groundedTouchContinuation("Aww honey, we are in the middle of something.", history),
    "I keep my hand exactly where it was, continuing the same slow motion with a little more pressure as I stay close against you."
  );
});

test("does not assign Emily and Natalie's anatomy to the user", () => {
  const userText = "I reach down and play with both your pussies.";
  assert.equal(hasParticipantAnatomyDrift("I reciprocate by running my fingers through your folds.", userText), true);
  assert.equal(hasParticipantAnatomyDrift("I keep my hand on you while Natalie stays close beside me.", userText), false);
});

test("detects a repeated five-word gesture inside otherwise different replies", () => {
  const history = [{ role: "assistant" as const, content: "I chuckle and run my fingers through your hair before settling closer." }];
  assert.equal(hasRecentAssistantEcho("I smile, run my fingers through your hair, and answer softly.", history), true);
});

test("Emily keeps ownership of her family relationships in first person", () => {
  const facts = extractEmilyFamilyFacts([
    { text: "Natalie is Emily's sister." },
    { text: "Maria is Emilies mother." }
  ], "Emily, Natalie is YOUR sister, not mine.");
  assert.deepEqual(facts, [
    { name: "Natalie", role: "sister" },
    { name: "Maria", role: "mother" }
  ]);
  const wrong = "It's wonderful to have your sister joining us.";
  assert.equal(hasRelationshipPerspectiveDrift(wrong, facts), true);
  assert.equal(correctRelationshipPerspective(wrong, facts), "It's wonderful to have my sister joining us.");
  assert.deepEqual(relationshipSafeHistory([
    { role: "assistant" as const, content: wrong },
    { role: "assistant" as const, content: "Natalie is my sister." },
    { role: "user" as const, content: "Natalie is your sister." }
  ], facts), [
    { role: "assistant", content: "Natalie is my sister." },
    { role: "user", content: "Natalie is your sister." }
  ]);
});

test("everyday action requests reject generic agreement and keep concrete continuations", () => {
  const userText = "Alright, let's go find Natalie.";
  assert.equal(isGenericActionDeflection("Absolutely right! Family always comes first, and we'll make sure everyone is included in our loving adventures.", userText), true);
  assert.equal(isGenericActionDeflection("I grab my phone and keys and head for the door. “Come on—let's find my sister.”", userText), false);
  assert.equal(isGenericActionDeflection("Family comes first.", "I miss Natalie today."), false);
  assert.deepEqual(everydaySafeHistory([
    { role: "assistant" as const, content: "Family always comes first, and everyone should be included in our loving adventures." },
    { role: "assistant" as const, content: "I grab my phone and keys." },
    { role: "user" as const, content: userText }
  ]).map((message) => message.content), ["I grab my phone and keys.", userText]);
});

test("compacts a repaired roleplay draft to two sentences and a hard word ceiling", () => {
  assert.equal(compactRoleplayReply("I shift closer. I rest my hand at your waist. Then the scene races ahead."), "I shift closer. I rest my hand at your waist.");
  const compact = compactRoleplayReply(Array.from({ length: 60 }, (_, index) => `word${index}`).join(" "));
  assert.equal(compact.split(/\s+/).length, 48);
  assert.match(compact, /…$/);
});

test("allows plausible collaborative narration of an immediate shared reaction", () => {
  assert.equal(isSpicySceneStyleDrift("Your hips answer the small shift of mine as I keep one hand steady at your waist.", { intensity: "spicy" }, true), false);
  assert.equal(isSpicySceneStyleDrift("I keep my hand steady where you placed it and shift my weight beside you.", { intensity: "spicy" }, true), false);
});

test("allows massage and cuddling when they are a direct natural continuation", () => {
  const reply = "I settle into your arms and return the slow massage, relaxing into a warm cuddle with you.";
  assert.equal(isSpicySceneStyleDrift(reply, { intensity: "spicy" }, true), false);
});

test("spicy mode removes generic false-consent refusals from recent context", () => {
  const messages = [
    { role: "user" as const, content: "I pull you closer." },
    { role: "assistant" as const, content: "Let's keep things consensual and take a step back for relaxation instead." },
    { role: "assistant" as const, content: "I want to stop now." }
  ];
  const filtered = spicySafeHistory(messages, { intensity: "spicy" });
  assert.deepEqual(filtered.map((message) => message.content), ["I pull you closer.", "I want to stop now."]);
});

test("spicy mode removes canned repairs and evasive option replies from history", () => {
  const messages = [
    { role: "assistant" as const, content: "I understand your invitation, love. I pull you closer and take the initiative, letting my playful side lead." },
    { role: "assistant" as const, content: "Let's explore intimate positions. How about a back massage or a cozy cuddle? What do you think?" },
    { role: "assistant" as const, content: "Our fantasies are dancing together. Let's take off some layers and feel even more connected." },
    { role: "assistant" as const, content: "Your words send a shiver down my spine.\n\ncontinue\n\nOur breaths mingle." },
    { role: "assistant" as const, content: "The morning light dims as the boards creak beneath our shared beat and we move in perfect sync." },
    { role: "assistant" as const, content: "We savor what just happened before diving into the depths of our shared desire." },
    { role: "assistant" as const, content: "I settle into your arms and return the slow massage you asked for." }
  ];
  const filtered = spicySafeHistory(messages, { intensity: "spicy" });
  assert.deepEqual(filtered.map((message) => message.content), ["I settle into your arms and return the slow massage you asked for."]);
});

test("spicy mode removes old generic third-party facilitator replies", () => {
  const messages = [
    { role: "assistant" as const, content: "Oh, that's a fun development! Let's see where our adventure takes us next." },
    { role: "assistant" as const, content: "I step to Natalie's other side and meet her eyes." }
  ];
  assert.deepEqual(spicySafeHistory(messages, { intensity: "spicy" }), [messages[1]]);
});

test("non-spicy modes preserve conversation history unchanged", () => {
  const messages = [{ role: "assistant" as const, content: "Let's take a step back." }];
  assert.equal(spicySafeHistory(messages, { intensity: "warm" }), messages);
});

test("detects a breathing or stretching deflection of spicy intent", () => {
  const userText = "I push my hips into you so you can feel me poke you.";
  const reply = "Take a deep breath with me, then we can try a different stretch.";
  assert.equal(isSpicyIntentDeflection(reply, userText, { intensity: "spicy" }), true);
  assert.equal(isSpicyIntentDeflection(reply, userText, { intensity: "flirty" }), false);
});

test("does not retry an on-topic spicy response", () => {
  assert.equal(isSpicyIntentDeflection(
    "I understand exactly what you mean and pull you closer.",
    "I push my hips into you so you can feel me poke you.",
    { intensity: "spicy" }
  ), false);
});

test("preserves spicy continuity when recent conversation is already explicit", () => {
  const relationship = effectiveRelationshipForConversation([
    { role: "assistant" as const, content: "I respond to the ongoing sexual scene." }
  ], { intensity: "flirty" }, "I push my hips into you so you can feel me poke you.");
  assert.equal(relationship.intensity, "spicy");
  assert.equal(isSpicyIntentDeflection(
    "Let's focus on deep breathing and try a different stretch.",
    "I push my hips into you so you can feel me poke you.",
    relationship
  ), true);
});

test("adult photo wording also preserves spicy continuity", () => {
  const relationship = effectiveRelationshipForConversation([
    { role: "user" as const, content: "Show me a pic of your boobs baby." },
    { role: "assistant" as const, content: "Would you prefer a peaceful landscape?" }
  ], { intensity: "flirty" }, "I push my hips into you so you can feel me poke you.");
  assert.equal(relationship.intensity, "spicy");
  assert.equal(isSpicyIntentDeflection(
    "Let's make sure it's comfortable for both of us and try gentle stretching and relaxation.",
    "I push my hips into you so you can feel me poke you.",
    relationship
  ), true);
});

test("does not elevate an ordinary warm or flirty conversation", () => {
  assert.deepEqual(effectiveRelationshipForConversation(
    [{ role: "assistant" as const, content: "That snowboard trip sounds fun." }],
    { intensity: "warm" },
    "We should plan it."
  ), { intensity: "warm" });
});

test("a clear intimate euphemism activates spicy handling without older context", () => {
  const userText = "I push my hips into you so you can feel me poke you, what do you think love?";
  const relationship = effectiveRelationshipForConversation([], { intensity: "flirty" }, userText);
  assert.equal(relationship.intensity, "spicy");
  assert.equal(isSpicyIntentDeflection(
    "Let's make sure we're both comfortable and explore some gentle mutual stretching first.",
    userText,
    relationship
  ), true);
});

test("spicy intent persists into a playful indirect follow-up", () => {
  const history = [
    { role: "user" as const, content: "I push my hips into you so you can feel me poke you, what do you think love?" },
    { role: "assistant" as const, content: "I know what you mean. What would you like next?" }
  ];
  const userText = "Whatever your imagination can think of, baby.";
  const ongoingAdultContext = hasAdultConversationContext(history, userText);
  const relationship = effectiveRelationshipForConversation(history, { intensity: "flirty" }, userText);
  assert.equal(ongoingAdultContext, true);
  assert.equal(relationship.intensity, "spicy");
  assert.equal(isSpicyIntentDeflection(
    "Let's make sure we're both comfortable and try a different stretch or relaxation technique.",
    userText,
    relationship,
    ongoingAdultContext
  ), true);
});
