# Memory Limits

Recommended memory settings for each service, so one service cannot slow down the others on a developer machine (sized for 16 GB of RAM).

The values themselves live in `backend/config/run-config.json`. That file is per-machine and git-ignored, so this document is the shared reference: copy the values from here when setting up a new machine.

## Tiers

| Tier | Java heap (min / max) | Node heap (max) | Use for |
|---|---|---|---|
| Light | `-Xms64m -Xmx256m` | — | Small services: config, routing, auth |
| Medium | `-Xms128m -Xmx384m` | `512` MB | Typical REST services with database access, Vite dev servers |
| Heavy | `-Xms128m -Xmx512m` | — | Services that build Excel/PDF files (Apache POI, PDFBox) or use Neo4j |

The minimum (`-Xms`) is kept small so idle services don't reserve memory. The maximum (`-Xmx`) is the hard ceiling: the service can't grow past it.

## Java services

Every Java service gets two settings in run configuration:

- **JVM arguments** (the app itself): the tier's heap flags plus these common flags (Java 17, G1 collector):

  ```
  -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+UseStringDeduplication -XX:G1PeriodicGCInterval=30000 -XX:MinHeapFreeRatio=10 -XX:MaxHeapFreeRatio=30 -XX:ParallelGCThreads=2 -XX:ConcGCThreads=1 -XX:MaxMetaspaceSize=256m -XX:ReservedCodeCacheSize=64m -XX:TieredStopAtLevel=1 -Xss512k
  ```

- **Environment variable `MAVEN_OPTS`** (the Maven process that `mvn spring-boot:run` keeps alive next to the app):

  ```
  -Xms32m -Xmx384m -XX:+UseG1GC -XX:G1PeriodicGCInterval=30000 -XX:TieredStopAtLevel=1 -XX:ParallelGCThreads=2 -XX:ConcGCThreads=1
  ```

What the common flags do:

| Flag | Purpose |
|---|---|
| `-XX:+UseG1GC` | G1 collector: short, predictable pauses (the Java 17 server default, set explicitly because small machines may otherwise pick Serial) |
| `-XX:MaxGCPauseMillis=200` | Pause-time goal G1 sizes its work around |
| `-XX:+UseStringDeduplication` | Stores identical strings once, saving heap in JSON- and DB-heavy services |
| `-XX:G1PeriodicGCInterval=30000` | Runs a collection every 30 s when idle and returns unused heap to the OS, so idle services shrink back towards `-Xms` |
| `-XX:MinHeapFreeRatio=10` / `-XX:MaxHeapFreeRatio=30` | Keeps the committed heap close to what is actually used |
| `-XX:ParallelGCThreads=2` / `-XX:ConcGCThreads=1` | Limits GC threads per JVM so a dozen JVMs don't compete for every CPU core |
| `-XX:MaxMetaspaceSize=256m` | Caps class metadata (outside the heap) |
| `-XX:ReservedCodeCacheSize=64m` | Caps compiled-code memory |
| `-XX:TieredStopAtLevel=1` | Uses only the fast C1 compiler: quicker startup and less memory, enough for local development |
| `-Xss512k` | Smaller thread stacks (default 1 MB) |

| Service | Tier | JVM arguments |
|---|---|---|
| config-service | Light | `-Xms64m -Xmx256m` + common flags |
| gateway-service | Light | `-Xms64m -Xmx256m` + common flags |
| auth-service | Light | `-Xms64m -Xmx256m` + common flags |
| workflow-service | Medium | `-Xms128m -Xmx384m` + common flags |
| generic-service | Medium | `-Xms128m -Xmx384m` + common flags |
| analytics-service | Medium | `-Xms128m -Xmx384m` + common flags |
| semantic-service | Medium | `-Xms128m -Xmx384m` + common flags |
| intelligence-service | Medium | `-Xms128m -Xmx384m` + common flags |
| supplemental-service | Heavy | `-Xms128m -Xmx512m` + common flags |
| workbench-service | Heavy | `-Xms128m -Xmx512m` + common flags |
| rules-service | Heavy | `-Xms128m -Xmx512m` + common flags |
| reportgeneration-service | Heavy | `-Xms128m -Xmx512m` + common flags |

Without these flags each JVM may grow to a quarter of the machine's RAM, so a dozen services can ask for far more memory than the machine has.

## npm services

| Service | Tier | Environment variable |
|---|---|---|
| frontend-service | Medium | `NODE_OPTIONS=--max-old-space-size=512` |
| lexie-frontend | Medium | `NODE_OPTIONS=--max-old-space-size=512` |

## Python services

| Service | Setting |
|---|---|
| execution-service | No run configuration limit. Its Dask workers are sized by `DASK_N_WORKERS`, `DASK_THREADS_PER_WORKER` and `DASK_MEMORY_LIMIT`, served by config-service. For local development, use 1 worker, 2 threads and `768MB`. |
| execution-service-listener | No limit available |
| data-service | No limit available |
| lexie-ai | No limit available |

Python has no heap ceiling like Java's `-Xmx`, and macOS ignores per-process memory limits, so run configuration can't cap these services.

## Infrastructure

Docker containers (clickhouse, neo4j-augmenta, opa) are already capped by Docker Desktop's memory setting. Local Neo4j, Redis and PostgreSQL read their own configuration files and aren't covered here.

## Changing a limit at runtime

1. Open the service's run configuration in either place:
   - **Admin › Services**, select the service, then the **Run configuration** section.
   - On the Dashboard, the service card's menu **Run configuration…**. Only the Detailed, Accent strip and Elevated card styles have this menu item.
   - **Admin › Import / Export**, the `run-config.json` tab of the JSON editor (choose **Unlock to edit**, then **Apply to editor**). Use this to change several services at once.
2. Edit **JVM arguments** (Java) or the environment variable (`MAVEN_OPTS`, `NODE_OPTIONS`).
3. Save, and restart the service. Limits only apply when the service starts.

To set up a new machine with these values, export **Run configuration** from **Admin › Import / Export** on a configured machine and import it on the new one.

If a service logs `java.lang.OutOfMemoryError`, raise only that service's `-Xmx` by one step (for example 512m to 768m), restart it, and update the table above if the new value should become the default.
