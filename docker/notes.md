# Run
./build-docker.sh


Need to tag this first (the way we want but here just latest)
```
docker tag datakit/app:latest datakitpage/datakit:latest
```

```
docker push datakitpage/datakit
```

with a specific tag

(PS: tagname should be incremental so you got to check the docker hub first)
```
docker push datakitpage/datakit:tagname
```