import assert from "node:assert/strict";
import test from "node:test";
import { relationshipGuidance, roleplayWritingGuidance } from "../src/services/relationship.js";
import { compactRoleplayReply, correctRelationshipPerspective, effectiveRelationshipForConversation, extractEmilyFamilyFacts, hasAdultConversationContext, hasFactualContinuityDrift, hasRelationshipPerspectiveDrift, isSpicyIntentDeflection, isSpicySceneStyleDrift, relationshipSafeHistory, singleAssistantTurn, spicySafeHistory } from "../src/services/ollama.js";

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
