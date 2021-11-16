FROM centos

ENV S3_BUCKET=vungle-aws-dev-sandboxes
ENV LIB_NAME=aws-sandbox
ENV VERSION=v1.0.0

RUN dnf module -y reset nodejs && \
    dnf module -y enable nodejs:14 && \
    dnf module -y install nodejs:14 && \
    dnf install -y zip python38 && \
    npm -g install typescript aws-sdk && \
    pip3 install virtualenv

ADD ./source /tmp/source
ADD ./deployment /tmp/deployment

RUN cd /tmp/deployment && \
    chmod 777 ./build-s3-dist.sh && \
    ./build-s3-dist.sh ${S3_BUCKET} ${LIB_NAME} ${VERSION}

RUN mv /tmp/deployment /