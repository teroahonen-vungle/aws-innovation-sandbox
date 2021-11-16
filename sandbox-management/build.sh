CONTAINER_NAME=tmpl
PROFILE=calevala-iam
REGION=us-east-1
SRC_DIR=/tmp/build/deployment
BUCKET=dev-sandbox-bootstrap
LIB=dev-sandbox-bootstrap
VERSION=v1.0.0
rm -Rf $SRC_DIR
mkdir -p $SRC_DIR
docker stop $CONTAINER_NAME
docker build . -t build:latest --progress plain
docker run --name $CONTAINER_NAME --rm -d -it build:latest
docker cp $CONTAINER_NAME:/deployment /tmp/build
docker stop $CONTAINER_NAME
#aws s3 cp $SRC_DIR/global-s3-assets/aws-innovation-sandbox.template s3://$BUCKET/aws-innovation-sandbox.template --profile $PROFILE --region $REGION
#aws s3 cp $SRC_DIR/regional-s3-assets s3://$BUCKET-$REGION/$LIB/$VERSION/ --recursive --profile $PROFILE --region $REGION --acl public-read