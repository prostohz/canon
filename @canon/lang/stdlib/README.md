# The standard library

This directory holds the normative description of the standard modules: the
entities not tied to any technology, and the roots every value descends
from. A vocabulary of a particular technology declares its entities as
specialisations of the ones here and is not added to this directory:
Kubernetes or Kafka will be replaced, `runtime:process` and
`network:endpoint` will remain. Examples of such a vocabulary are kept in
the repository of the language, in `@canon/lang/examples`.

The directory holds no special position: the name `stdlib` is a convention,
not a place the tool knows about. A module is named after its file and is
connected by the word `uses`, not by a path, so a vocabulary may lie
anywhere. It goes out inside `@canon/lang`, with the definition of the
language it is written in and under the same version, and a project names
it there — in the package npm installed for it — rather than copying it in;
that changes nothing for the tool, which is still given a path.

Every module is written in the [canon](../docs/README.md) language; the
file name matches the module name.

The meaning of every entity is given as free text in a `means` block: it is
addressed to a human and is not interpreted. What is addressed to the
machine is the structure — which entity is declared in which module.

The prose of the library is written in plain, definitional style and holds
only the definition of the thing — no motivation, no instructions on how to
use the entity, no comparisons with other entities. The vocabulary is
portable between projects, and the manner of writing is chosen for that.

Short names coinciding in different modules does not make the entities
identical: `quality:metric` and `observability:metric` are different
entities.

How all of this is written down is a matter for the language, see
[`language.md`](../docs/language.md).

## Rules of definition

- A definition describes the meaning of an entity, not the format of its
  storage or its implementation.
- The terms "type", "instance" and "relation" are used in the sense of the
  logical model of a specification.
- If an entity represents another entity, that is said in the definition
  and is not implied by a similarity of names.
- Technological implementations are instances or specialisations of the
  standard entities but do not alter their definitions.
- An entity belongs to the module whose area defines its identity. Using an
  entity in another area is expressed by a reference to it, not by
  declaring it again.
- The area of a module is set at its very beginning and serves as the
  criterion for which module a new entity belongs to.

## Checking

In a project, where the library is one path of the set, it is checked along
with everything else:

    canon check

In the repository of the language, where the library is checked on its own:

    cd ..
    npm run check -- stdlib

What is checked is the structure: uniqueness of names, the module name
matching the file name, resolvability of supertypes and references. The
content of the definitions is not checked — it is free text.

## Modules

- [`core`](core.canon) — the roots of the value hierarchy and their minimal
  refinements.
- [`system`](system.canon) — general entities about a software system, its
  parts, capabilities and participants.
- [`data`](data.canon) — the logical organisation of data.
- [`syntax`](syntax.canon) — the written form of a formal language and the
  tree a text is read into.
- [`source`](source.canon) — text as the subject of processing, and the
  coordinates of a place in it.
- [`file`](file.canon) — named containers of data and the paths addressing
  them.
- [`identity`](identity.canon) — recognising subjects and their authority.
- [`interaction`](interaction.canon) — purposeful interaction of actors
  with the system.
- [`api`](api.canon) — contracts for calling operations between systems.
- [`ui`](ui.canon) — the user interface.
- [`cli`](cli.canon) — interaction with a program through a command line.
- [`localization`](localization.canon) — adapting presentation to language
  and region.
- [`runtime`](runtime.canon) — the actual execution of components.
- [`deploy`](deploy.canon) — preparing releases and placing them.
- [`infrastructure`](infrastructure.canon) — managed technical resources.
- [`network`](network.canon) — addressing, connectivity and data transfer.
- [`storage`](storage.canon) — the lasting retention of data.
- [`messaging`](messaging.canon) — the exchange of messages between loosely
  coupled participants.
- [`security`](security.canon) — protecting valuable entities from threats.
- [`privacy`](privacy.canon) — the handling of personal data.
- [`quality`](quality.canon) — measurable characteristics of a system.
- [`observability`](observability.canon) — external evidence about internal
  execution.
- [`reliability`](reliability.canon) — preserving behaviour under failures.
- [`requirements`](requirements.canon) — statements about required
  properties.
- [`traceability`](traceability.canon) — the correspondence between
  labelled statements and the places carrying them out.
- [`diagnostics`](diagnostics.canon) — findings a tool states about the
  input it has processed.
- [`verification`](verification.canon) — obtaining evidence that
  requirements are met.
