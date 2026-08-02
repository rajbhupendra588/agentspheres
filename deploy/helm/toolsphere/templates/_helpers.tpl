{{- define "toolsphere.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "toolsphere.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name (include "toolsphere.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "toolsphere.labels" -}}
helm.sh/chart: {{ include "toolsphere.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "toolsphere.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "toolsphere.selectorLabels" -}}
app.kubernetes.io/name: {{ include "toolsphere.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "toolsphere.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "toolsphere.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
