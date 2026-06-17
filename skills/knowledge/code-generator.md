# Code Generator — Knowledge Reference

## Principles

- **Generate from contract, not from intent**: The code-generator transforms explicit, structured contracts (architecture modules, interface specs, feature plans) into code. It does not infer structure from prose descriptions. Ambiguous specs are rejected.
- **Minimal generation over maximal generation**: Generate the minimum code required to satisfy the contract. Do not generate convenience wrappers, utility helpers, or infrastructure that was not specified. Every generated line must be traceable to a spec field.
- **Conflict avoidance over overwrite**: When a generated file conflicts with an existing one, produce a `*.new.*` variant — never overwrite. Merge decisions belong to the human operator.
- **Syntax validity is a hard gate**: Generated code that fails syntax parsing is never written to state. A syntax error in generated code is a generator failure, not a code-repair case.
- **Documentation stubs are mandatory**: Every public function and exported interface gets a documentation stub at generation time. Undocumented public API is an anti-pattern.

## Generation Templates by Language

Each language has a canonical template structure for each `generation_target`:

| Target | TypeScript | Python | Go |
|--------|-----------|--------|----|
| `module` | `class` with JSDoc + barrel export | `class` with docstring + `__all__` | `package` + struct + methods |
| `interface` | `interface` declaration | `Protocol` class (ABC) | `interface` + implementation stub |
| `test_stub` | `describe`/`it` Jest skeleton | `class Test*` pytest skeleton | `func Test*` go_test skeleton |
| `scaffold` | `src/` tree with index.ts | Package directory with `__init__.py` | Go module with `cmd/` and `pkg/` |
| `migration` | TypeORM/Prisma migration | Alembic migration | golang-migrate |

## Import Resolution Order

1. Check `existing_code_map` for the module that owns the dependency
2. Check `architecture.modules` for a declared module boundary
3. If neither: generate a placeholder import comment `// TODO: resolve import <name>`

## Anti-patterns

- **Spec inflation**: Expanding the spec during generation by adding "helpful" extras (logging, error handling boilerplate, configuration options). Generate what was specified — nothing more.
- **Overwrite on conflict**: Silently overwriting existing files when a conflict is detected. This destroys hand-crafted code. Always produce `*.new.*` variants.
- **Template leakage**: Leaving template placeholders (e.g., `{{MODULE_NAME}}`, `TODO: replace`) in generated output. All placeholders must be resolved before output is returned.
- **Language-agnostic generation**: Generating generic code without applying language-specific idioms (e.g., generating Python code that looks like Java). Generated code must be idiomatic for its target language.

## Source References

- Design by Contract (Bertrand Meyer, "Object-Oriented Software Construction")
- Code generation best practices (Yeoman, Hygen, Plop)
- Abstract Syntax Tree (AST) manipulation for code validation
