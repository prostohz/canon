# The canon language

This document defines every construct of the language. There are no
others: a record not described here is not a specification. The admissible
order of tokens is in [`grammar.ebnf`](grammar.ebnf); the documents are
normative together.

The boundary follows a single criterion: **formal is what an agent builds
the data schema from; prose is everything else.** Precision lives in the
declarations and in the names a requirement refers to, not in the text of
the requirement itself.

## Language version

A file opens with a version declaration:

    language 0.1.0

The version is compared character by character. A tool that understands a
different version must refuse to parse the file rather than read it by
rules of its own. Compatibility between versions is not described by the
language.

## Shape

Every construct has one shape: **a keyword, a heading on its own line, an
indented body.** There are no exceptions.

    language 0.1.0
    module shop
      uses core, data, identity
      means
        A small online shop: catalogue, cart, checkout and payment of an
        order.

    value price : core:decimal
      means
        price: what a product costs in the catalogue, greater than zero.

    enum publication-state
      draft
      published
      hidden
      means
        publication state of a product: draft — entered but not shown;
        published — shown and sold; hidden — taken off the storefront.

    entity product : data:record
      price             : price
      stock             : stock
      publication-state : publication-state
      images            : product-image     many
      means
        product: an item of the catalogue with a price, stock and a
        publication state.

    requirement R-014
      states
        A published [product|product] must have a [stock|stock] greater
        than zero.
      because
        The catalogue shows only what can be bought right now.

## Module

A module is a file `<name>.canon`; the file name matches the module name.
Module names are unique across the whole set. There are no special
directories: [`stdlib`](../stdlib/README.md) is a convention, not a place
the tool knows about.

`uses` lists the modules that may be referenced, and makes an accidental
link between areas an error instead of an unnoticed fact. The field is
optional — without it there is no restriction — and there may be several
`uses` lines. Paths are never written: the tool is handed a set of files and
knows every module by name.

## Entity

    entity product : data:record

After the colon stands the supertype: its parts are available on the
descendant, and overriding a part is an error, not a refinement. The chain
is walked to the end; a cycle in it is an error.

`thing` is the only name built into the language and the top of both
hierarchies. The supertype of an entity must be an entity, the supertype of
a value must be a value: the two hierarchies must not be mixed.

**An entity may omit its supertype, a value may not.** `entity alone` is
accepted: an entity is free to attach to nothing. A value must reach one of
the `core` roots, or what kind of quantity it is stays unknown.

An entity without composition is the ordinary case of a vocabulary:

    entity record : thing
      means
        record: a composite value made of named fields and representing
        one logical data object.

An own name is written short, a foreign one qualified with a colon:
`data:record`. Qualification is required always, even when the short name is
unique — otherwise adding a module would change the meaning of existing
text, and `quality:metric` and `observability:metric` would differ only in
the reader's memory.

## Composition

    entity order : data:record
      order-number : order-number
      order-state  : order-state
      items        : order-item   many optional
      comment      : comment      optional

On the left is the name of the part, on the right its type — so two parts of
one type differ by themselves:

    entity reconciliation
      previous-tree : element
      next-tree     : element
      nodes         : node    many optional

The type of a part is an entity, an enum or a value. `thing` cannot be the
type of a part: it is the top of a hierarchy, not a type.

### One or a collection, present or absent

Two independent questions. Does the part hold one thing or a collection —
`many`. May the part be missing altogether — `optional`. Each word means the
same whichever way the other is answered.

| Written | Meaning |
|---|---|
| — | one |
| `optional` | one, or nothing |
| `many` | a collection |
| `many optional` | a collection, or nothing |

**Nothing written is one, and present** — the commonest case and the
strictest of the four, so it is the one that costs no word. Anything weaker
is said out loud, and a reader looking for what may be missing finds it by
looking for a word rather than by noticing the absence of one.

The words may be written in either order, and each at most once. There are
no others.

**How many are in a collection is not among the questions.** That a level
holds at least one surface, that a queue holds at most eight, that two of
them are never the same, that their order is the order they are served in —
all of that is **prose**, by the same rule that sends "the price is greater
than zero" there. These are obligations on what a part holds, not on the
shape holding it.

## Value

    value price : core:decimal
    value second : core:decimal
    value page-load-time : second

A value is the second hierarchy, built like the first: after the colon
stands the supertype, the chain is walked to the end and lands on `thing`.
The difference is only in what stands at the top: entities descend from
`data:record` and the like, values from the roots of the `core` module.

**There is no list of types in the language.** The roots — `core:number`,
`core:text`, `core:boolean`, `core:binary` and `core:moment` — are declared
by the library in the ordinary way and refined there as well, with
`core:integer` and `core:decimal` beside them:

    value millicore : core:integer
    value cpu-amount : millicore

A constraint on a value is expressed **by the name of a refining type and by
prose**, not by a construct of its own: `value price : core:decimal` with
the definition "price: … greater than zero" says exactly as much as `> 0`
would have.

Units of measurement are ordinary values, with no construct of their own:
`value page-load-time : second` says that time is measured in seconds in the
same way `entity pod : runtime:process` says what a pod is.

## Enumeration

    enum order-state
      new
      confirmed
      cancelled

Defines a closed list of values and must hold at least one.

## Requirement

    requirement R-009
      states
        The [quantity|quantity] in a [cart-item|cart item] must not
        exceed the [stock|stock] of the corresponding [product|product].
      because
        The shop must not sell what it does not have.

`states` is required; `because` and `obligation` are not.

The text of a requirement is not parsed. What is checked is that the
entities mentioned are declared and that the label is unique across the set.
Whether the label occurs in the code is a warning, and only when the tool
has been given a directory of sources.

### How binding a requirement is

`obligation` is written with one of two words, and there are no others:

| Written | Meaning |
|---|---|
| — | conformance is impossible without meeting it |
| `mandatory` | the same, said out loud |
| `recommended` | a departure is admissible where it is justified |

**Nothing written is `mandatory`.** A requirement is stated in order to be
met, so the binding case is the one that costs no word. Anything weaker is
said out loud:

    requirement NFR-3
      states
        A page of the [catalogue|catalogue] is shown within two seconds of
        being asked for.
      because
        A buyer who waits leaves, and a shop is judged on how it answers
        before it is judged on what it holds.
      obligation recommended

**What justifies a departure is prose.** The word says that a departure may
be justified; which one is justified is settled where the departure is
proposed.

The scale is closed on purpose. A priority — high, medium, later — orders
work and answers to whoever plans it; an obligation says what conformance
means and answers to whoever checks it. Only the second is a property of the
requirement itself.

### Labels

A label is capital Latin letters and digits separated by a hyphen: `R-014`,
`NFR-7`. The hyphen is required: without it `NFR7` is not a label and
parsing does not accept it — this is how a label differs from everything
else in the text. The prefix is free and opaque to the tool: `R`, `NFR`, `A`
and `X` are a convention of a document, not a distinction the language
answers for.

Labels are global and do not belong to a module: they serve as an address
for the code, and the code knows nothing of modules. Bind a label to a
module and moving a requirement would change the address. A label is
stable — it does not change when the wording is reworked and is not reused
after deletion, which is why gaps in the numbering are normal.

Uniqueness is counted over the checked set, and a set is one delivery.
Unrelated documents are not checked together: reconciling their numbers is
pointless, and they share no code.

Prose refers to no labels: a label addresses a statement, and a statement is
not a thing a sentence reaches into. Where one is written in a sentence all
the same, it is a word of that sentence and the tool passes it by. A label is
addressed in a clause of a declaration instead — see [Link](#link).

## Assumption

    assume A-001
      states
        Every [identity:account|account] holds exactly one
        [identity:identity|identity].

A statement about the environment, taken to be true. It is not to be
implemented and is not counted among what is. The label is optional.

## Exclusion

    exclude X-101
      states
        A double jump, a dash, a wall jump, crouching and an attack by
        the character of a [player|player] are not part of the first
        version.
      because
        Every additional mechanic needs levels and a tutorial of its own.

A refusal of work: not something forgotten but something deliberately left
outside the scope. The shape is an assumption's; the label is optional but
useful — a refusal that has to be spoken of at all is spoken of by its name.

An exclusion **is not a requirement**: it is not counted among requirements
and it cannot be implemented. Otherwise every refusal would forever stand as
unimplemented, understating the share of work done by their number.

A missing `because` is a warning, as on a requirement, and should be read
more strictly: a requirement without a rationale still prescribes something,
a refusal without a reason says nothing at all.

The three kinds of statement cover different things: `assume` — what is
taken from the environment, `requirement` — what is promised, `exclude` —
what has been declined.

## Link

A statement addresses another by its label, in a clause of the declaration:

    requirement R-031
      replaces R-014
      given A-003
      states
        An [order|order] whose [order.order-state|state] is
        [order-state.placed|placed] is charged once.
      because
        A second charge is money taken twice.

There are two words and no others. Both are written like `uses` — a list on
the line, and as many lines as are wanted — and both are optional.

**A link is written where the new statement stands and addresses one that was
already there.** The replacement names what it replaces; what is replaced
says nothing. So no file is ever edited because something turned up
elsewhere, and a label stays what it was on the day it was written.

Only two are admitted, by the criterion the whole language is cut by: a link
is formal where the tool derives something from it that a reader does not get
by reading. What the two derive differs, and so does what is checked of them.

### `replaces`

**What is in force.** A replaced statement is no longer among what the set
requires: conformance is meeting the requirements in force, and a replacement
takes the place of what it replaces rather than standing beside it. Without
the word, R-014 and R-031 stand together and contradict each other, and
nothing knows.

Either end may be a statement of any kind. A requirement replacing an
exclusion is the ordinary way a refusal is reversed —

    requirement R-050
      replaces X-101
      states
        The character of a [player|player] may dash.

— and it is the case the word most has to serve: the alternative is deleting
the exclusion, and the record of what was once declined is the thing an
`exclude` exists to keep. Which kinds fit at either end is prose, as the
relation between two entities is.

Both ends are plural. Two statements merged into one are two labels on one
`replaces`; one split into two is written on the two that replace it.

**A replaced statement stays where it was written**, and is checked as
before. It is out of force, not out of the set: what it once promised is the
reason for keeping it, and a text left behind unchecked would rot into a
statement about names that are no longer there.

### `given`

**What has to be read again.** An `assume` is taken to be true and is
implemented by nobody; on its own it is a paragraph the tool has nothing to
say about. Named by the requirements leaning on it, it earns its place twice
over: an assumption nothing leans on is dead weight, and an assumption
withdrawn hands over the exact list of statements to re-read.

The other end must be an assumption — there the kinds are checked, because a
link to a requirement would buy nothing at all. `given` may stand on a
requirement and on an exclusion, and not on an assumption: an assumption
leaning on an assumption makes them a hierarchy, and what falls with one
stops being a list.

The word is the English one for a premise, and it is not a form of `assume`
on purpose: two keywords apart by an inflection are two the eye reads as one,
and the tie between the declaration and the link is better carried by the
meaning than by the spelling.

**A labelled assumption that underlies nothing is a warning.** Only a
labelled one: a label is an address, and an address nobody writes down is
what is worth reporting. An assumption written without one asks to be read
along with the rest, not to be addressed.

### What is not a link

That one requirement refines another, that two contradict each other, that a
requirement stops where an exclusion begins — all of it is **prose**, and by
the rule above. From "refines" nothing is derived: the tool would check that
the label exists and no more, while the word claims a relation nobody
verified — the divergence between the ordinary reading and the normative one
that this language was built to avoid. And a contradiction recorded is a
contradiction kept: two requirements that disagree are to be repaired, not
annotated, and finding them is work for the tool rather than for the author.

## Reference

A reference has one shape: **an address, a bar, a caption.**

    [order#source|order]

On the left is what is meant, and the tool answers for it. On the right is
what this sentence calls it, and the author answers for that.

### The caption

**Every address carries one**, with no proviso for when the name would have
done: such a proviso leaves the fit to the author's judgement sentence by
sentence, and makes a caption left out indistinguishable from a caption not
needed. One shape settles both — the word of the sentence for the reader,
the address beside it for the reviewer.

In the choice of word the author is free: number, capital letter, a hyphen
replaced by a space, a prefix dropped once the thing has been named, an
altogether different word if the sentence asks for one.

    [queue|queues]
    [broker-message|Messages]
    [privacy:personal-data|personal data]
    [broker-connection|connections]
    [ui:screen|interface]
    [identity:account|account]
    [source.order-state|its state]

Nothing of the address leaks into the caption — not the module qualifying
it, not the name a thing was given here, not the part reached into. One
condition remains, and nothing can check it: the reader must recognise the
thing by the caption. Identity is carried by the left side, and it is the
left side that stays in place when the sentence is rewritten.

### What can be referenced

A target is an **address**, and there is no other kind. It stands for a
thing, or for something belonging to one. Seven forms, and every reference
in a specification is one of them:

    [order|…]                 a name declared in this module
    [data:record|…]           a name declared in another module
    [order.order-state|…]     a part of an entity, its own or an inherited one
    [order-state.placed|…]    a value of an enum
    [order#source|…]          a name given here to one thing of that type
    [source|…]                that thing, wherever it comes up again
    [source.order-state|…]    a part of that thing

A declared name is an entity, an enum or a value. `thing` is not among them:
it holds no parts and gives its name to nothing. A name introduced here
belongs to the text and not to a module, so nothing is ever written before
it. An own name may also be written qualified — `[shop:order|order]` inside
the module `shop` resolves — but it is redundant.

**`#` and `.` never meet in one address.** The type stands where the name is
introduced and nowhere after: `[order#source.order-state|…]` is an error,
and what it reaches for is written `[source.order-state|…]`.

An address is **one member deep**. `[order.items.price]` is not an address:
a path through a collection would have to say which of the items it means,
and the language has nothing to say that with. To speak of an item, refer to
`order-item` and to its parts.

**A label is not a target here.** A sentence reaches into things, and a
statement is not one. Where a statement addresses another it does so in a
clause of the declaration — [Link](#link) — and a label written inside a
sentence stays a word of that sentence: neither checked, nor counted among
what a requirement refers to, nor complained about.

### A part and a value of an enum

A rule usually turns on them:

    An [order|order] in the state `placed` must have a
    [delivery-address|delivery address].

Written so, the two things the rule actually turns on — the part holding the
state, and the value `placed` — are text nobody answers for. Rename the part
or drop the value from the enum and the requirement stands, saying something
about names that are no longer there.

    An [order|order] whose [order.order-state|state] is
    [order-state.placed|placed] must have an
    [order.delivery-address|delivery address].

Now the rename breaks the check. What became formal is only the names: that
the state has to be `placed` for the address to be owed is a relation
between them, and relations stay prose.

### One text, one thing — and which one

Within one text the name of a type stands for **one thing** of that type.
The `[order|order]` of a requirement and the
`[order.delivery-address|delivery address]` of the same requirement address
one order, not two. Without that reading every mention would be an
independent lookup into the vocabulary, and whether the second sentence is
about the order of the first would be nobody's business.

When one text speaks of two things of one type, `#` gives one of them a
name:

    An [order#source|order] is merged into an [order#target|another order]
    when [source.order-state|its state] is [order-state.placed|placed], and
    [source|it] is closed the moment [target|the other] takes it in.

`[order#source|order]` says: a thing of type `order`, called `source` here.
Afterwards the name stands alone. **The type is written where the name is
introduced and never again** — one position, one spelling, and a name whose
type the reader finds in the same text rather than in the module.

It is a variable, with the whole of what a variable usually brings left out:
no quantifier, no predicate, nothing built upon it. Four things are checked,
and all four are mechanical:

- the type is declared;
- **a name is introduced once and repeats no declared name** — so it shadows
  nothing and needs no rule of precedence;
- **a name used was introduced** — `[sorce.order-state|…]` is an error, not
  a third order that came from nowhere;
- **a named type no longer stands for a thing** — `[order|order]` beside
  `[order#source|…]` would ask which of the two it is, and the part of a
  named order is reached through its name as well:
  `[source.delivery-address|…]`.

The name is held for the length of one text: the `states` and the `because`
of one statement count as one, and the same `source` in another requirement
is another name. Beyond the statement the tie between requirements is the
label — a requirement is read on its own.

A name may be introduced of any type, an enum among them —
`[order-state#before|the state before]`. What belongs to the enum belongs to
it and not to the name: `placed` is written `[order-state.placed|placed]`,
because it is the same constant in every sentence.

Often no name is needed. Two things of one type that interact are frequently
a thing themselves, and then the parts of that thing name them:

    entity reconciliation
      previous-tree : element
      next-tree     : element

`[reconciliation.previous-tree|the previous tree]` tells them apart with
nothing new. A name is for what has no such thing to hang on: that no two
orders of one customer carry the same number is about two orders that
nothing holds together.

### Where references are significant

Only inside blocks of free text — `states`, `because` and `means`,
including the `means` of a module. Declaration headings hold no square
brackets at all: there a name stands on its own.

A caption may span several lines — a break inside a reference is allowed
and is preserved when displayed:

    [delivery-address|delivery
    address]

A literal bracket is escaped: `\[`. The closing one needs no escaping.

### What is checked

That the target resolves.

- Of a declared name — that it is declared, that its module exists and is
  listed in `uses`, and that a member of it is a part of that entity, its
  own or an inherited one, or a value of that enum.
- Of a name introduced in the text — that its type is declared, that the
  name stands once, that it repeats no declared name, that a name used was
  introduced, and that the type it names is not addressed as a thing beside
  it.
- Of a label inside prose — nothing at all.

The links of a declaration are checked apart from this: that the label is
carried by a statement of the set, that the chain of `replaces` does not
close on itself, and that what `given` names is an assumption.

**The caption is not checked.** The tool will allow `[queue|orders]`:
comparing words is beyond it, and lawful divergences are so numerous that
any attempt would turn into false alarms. Whether the thing is recognisable
is decided by the author and by the reviewer, who sees both sides.

**That a caption is there at all is checked.** `[order]` is an error, and so
is `[order| ]`.

## Text block

Free text occupies an indented block. There are no quotation marks: text is
full of apostrophes, and paragraphs cannot be expressed inside a line.

A block is opened by a keyword standing alone on its line — which is why
`states : state*` reads as a part named `states` and not as the start of
prose.

The amount of indentation carries no meaning: all that matters is that a
nested block is indented deeper than the line opening it. A tab is rejected
by parsing.

A comment runs from `#` to the end of the line, outside text blocks.

## Keywords

Seventeen:

`language`, `module`, `uses`, `means`, `entity`, `enum`, `value`,
`requirement`, `assume`, `exclude`, `states`, `because`, `obligation`,
`replaces`, `given`, `many`, `optional`.

There are no kinds of value among them: what a value may be is declared in
the library, so that vocabulary grows without touching the language.

A keyword may name an entity — `data:value` and `requirements:obligation`
are the proof. What it may not name is a part of a record or a value of an
enum: there a keyword reads as the opening of a block. The exact conditions
are in the grammar.

`mandatory` and `recommended` are not among the fifteen. They stand in one
position and are reserved nowhere else: an enum of a specification is free
to hold a value of either name.

## What stays prose

Named explicitly, so that it does not look like an oversight.

**Actions and state transitions.** The language is ready for them — an
action is added as a seventh alternative of `declaration` without touching
the rest — but while prose copes there is no construct.

**Invariants on values.** "The price is greater than zero", "the quantity
does not exceed the stock". What is expressed formally is structure, not
obligations on values.

**Time, deadlines, scopes of effect.** "Within 5 seconds", "in checkout
mode".

**Deliberate underspecification inside the scope.** "The behaviour in this
case is undefined" is an ordinary phrase, and a machine will not tell it
from forgetfulness. `exclude` refuses work as a whole and is visible to the
machine; an underspecified case inside accepted work is not.

**Relations.** That an order belongs to a customer, that one message answers
another. A relation is an obligation on what the parts hold, and the
sentence stating it states the whole of it; a declared verb would add a name
for it and nothing else.

**What holds between two statements, beyond the two links.** That one
requirement refines another, that two contradict each other, which departure
from a `recommended` one is justified: [What is not a link](#what-is-not-a-link)
says why.
