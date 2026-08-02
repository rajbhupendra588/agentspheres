# ToolSphere gRPC contract

`v1/tools.proto` reserves the wire contract for ToolSphere's tenant-scoped registry and execution runtime. The Gateway REST API remains the primary integration surface today; its canonical OpenAPI document is [`services/gateway/openapi/openapi.yaml`](../../services/gateway/openapi/openapi.yaml).

Code generation is intentionally not wired into the build yet. When a gRPC transport is introduced, generate server and client stubs from this source and keep the protobuf and shared TypeScript contracts (`packages/contracts/src/tools.ts`) compatible.
