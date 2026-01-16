FROM python:3.10

ARG ssh_prv_key_pnd_cb_database_connector
ARG ssh_prv_key_pnd_cb_gcs
ARG ssh_prv_key_pnd_cb_gsheets_connector
ARG ssh_prv_key_pnd_cb_utils

#SSH
RUN apt-get update && \
    apt-get install -y openssh-server wget

RUN mkdir -p /root/.ssh && \
    chmod 0700 /root/.ssh

RUN echo "$ssh_prv_key_pnd_cb_database_connector" > /root/.ssh/pnd_cb_database_connector && \
    echo "$ssh_prv_key_pnd_cb_gcs" > /root/.ssh/pnd_cb_gcs && \
    echo "$ssh_prv_key_pnd_cb_gsheets_connector" > /root/.ssh/pnd_cb_gsheets_connector && \
    echo "$ssh_prv_key_pnd_cb_utils" > /root/.ssh/pnd_cb_utils && \
    chmod 600 /root/.ssh/*

RUN ssh-keyscan github.com > /root/.ssh/known_hosts

#SET UP
COPY src /code
COPY requirements.txt /code/requirements.txt

#MOVE SSH CONFIG
COPY ssh_config /root/.ssh/config

#INSTALL
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

#SET PYTHONPATH
ENV PYTHONPATH="${PYTHONPATH}:/code/python"

#CLEAN UP
RUN rm -rf /root/.ssh/

#RUN
WORKDIR /code/python
CMD ["python", "pipelines/main_process.py"]
