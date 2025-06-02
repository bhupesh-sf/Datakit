# Run
./build-docker.sh


no need to tag this if we dont have it
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